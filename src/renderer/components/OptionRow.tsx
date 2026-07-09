import { Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from 'renderer/lib/utils'

/**
 * OptionRow — single-selectable row primitive for multi-select wizards.
 *
 * Visual: a horizontal row that flips to `selected` state with an
 * accent left border and a filled checkbox in the leading slot.
 *
 * The whole row is the click target. We render a native
 * `<input type="checkbox">` (visually hidden, screen-reader-only)
 * inside a `<label>` so we keep native form behaviour — Space toggles,
 * clicking anywhere on the label fires `onToggle`, and the input is a
 * real form participant so external `<form>` libraries work.
 *
 * Parent owns selection state and decides how to mutate it; this
 * primitive is purely presentational.
 *
 * Tokens: --accent, --background, --border, --muted-foreground, --danger.
 * No hard-coded hex.
 */
export interface OptionRowProps {
  id: string
  label: string
  subtitle?: string
  /** Small grey right-aligned note, e.g. "113°C · 60 min". */
  meta?: string
  selected: boolean
  /** Called when the user toggles the row (click or Space). Parent owns state. */
  onToggle: () => void
  disabled?: boolean
  icon?: LucideIcon
  /** Extra content rendered after the text stack (e.g. a numeric badge). */
  previewSlot?: ReactNode
  /** Optional override className appended to the row. */
  className?: string
}

export function OptionRow({
  id,
  label,
  subtitle,
  meta,
  selected,
  onToggle,
  disabled = false,
  icon: Icon,
  previewSlot,
  className,
}: OptionRowProps) {
  const inputId = `option-row-${id}`

  return (
    <label
      aria-disabled={disabled || undefined}
      className={cn(
        'group/option-row flex min-w-0 cursor-pointer items-center gap-3 rounded-lg',
        'border-l-4 border-l-transparent',
        'border-y border-r',
        // Only border-color + background-color animate. No scale / translate.
        'transition-[border-color,background-color] duration-200',
        'px-3 py-2.5',
        selected
          ? 'border-l-[var(--accent)] border-y-[var(--accent)] border-r-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)]'
          : 'border-[var(--border)] bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)]',
        'hover:border-[color-mix(in_oklab,var(--accent)_55%,var(--border))] hover:bg-[color-mix(in_oklab,var(--foreground)_7%,transparent)]',
        'focus-within:border-[var(--accent)]',
        disabled &&
          'cursor-not-allowed opacity-50 hover:border-[var(--border)] hover:bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)]',
        className
      )}
      data-option-row-id={id}
      data-selected={selected ? 'true' : 'false'}
      htmlFor={inputId}
    >
      <input
        // Prefer the explicit `label` for assistive tech even when the
        // row already exposes label/subtitle as text — names follow focus.
        aria-label={label}
        checked={selected}
        className="peer sr-only"
        disabled={disabled}
        id={inputId}
        onChange={onToggle}
        type="checkbox"
      />

      <span
        aria-hidden="true"
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
          'transition-[border-color,background-color] duration-200',
          selected
            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]'
            : 'border-[var(--border)] bg-[var(--background)]'
        )}
      >
        {selected ? <Check className="h-3 w-3" /> : null}
      </span>

      {Icon ? (
        <Icon
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-[color-mix(in_oklab,var(--foreground)_70%,transparent)]"
        />
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-sm font-medium text-[var(--foreground)]">
          {label}
        </span>
        {subtitle ? (
          <span className="truncate text-xs text-[var(--muted-foreground)]">
            {subtitle}
          </span>
        ) : null}
      </span>

      {meta ? (
        <span className="shrink-0 text-xs text-[var(--muted-foreground)] tabular-nums">
          {meta}
        </span>
      ) : null}

      {previewSlot ? <span className="shrink-0">{previewSlot}</span> : null}
    </label>
  )
}
