/**
 * ProductTypeTooltip — "what does this mean?" expander.
 *
 * The architecture doc §8.4 calls for a small `?` icon next to each
 * product-type label that expands a 1-2 sentence definition in
 * place. This component wraps the existing `TooltipIcon` primitive
 * (design-system scope) and renders the expander inline.
 *
 * Default state: collapsed (the `?` icon shows; the definition
 * doesn't). Tapping the `?` icon toggles the definition. Hovering
 * the icon also shows a brief preview (delegated to TooltipIcon's
 * built-in hover behaviour), but the full definition only shows
 * after an explicit tap.
 */
import { useId, useState } from 'react'
import { cn } from 'renderer/lib/utils'
import { Info } from 'lucide-react'

export interface ProductTypeTooltipProps {
  /** 1-2 sentence definition. Required. */
  text: string
  className?: string
}

export function ProductTypeTooltip({
  text,
  className,
}: ProductTypeTooltipProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <span
      className={cn('inline-flex flex-col items-start gap-1', className)}
      data-testid="product-type-tooltip"
    >
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-label="Show explanation"
        className="inline-flex shrink-0 items-center justify-center rounded-full p-0.5"
        data-testid="product-type-tooltip-trigger"
        onClick={() => setOpen(v => !v)}
        type="button"
      >
        <Info
          aria-hidden="true"
          className="size-4 shrink-0 cursor-help text-foreground/70 transition-colors hover:text-foreground/80"
        />
      </button>
      {open && (
        <span
          className="rounded-md border border-foreground/20 bg-card px-2.5 py-1.5 text-left text-xs leading-relaxed text-foreground/90 shadow-md"
          data-testid="product-type-tooltip-panel"
          id={panelId}
          role="note"
        >
          {text}
        </span>
      )}
    </span>
  )
}
