import { cn } from 'renderer/lib/utils'

interface UnitToggleProps<T extends string> {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  ariaLabel?: string
}

export function UnitToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel = 'Unit options',
}: UnitToggleProps<T>) {
  return (
    <div
      aria-label={ariaLabel}
      className="inline-flex shrink-0 flex-wrap rounded-lg border border-foreground/20 bg-foreground/5 p-0.5"
      role="group"
    >
      {options.map(opt => (
        <button
          aria-pressed={value === opt}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:px-3',
            value === opt
              ? 'bg-foreground/15 text-foreground'
              : 'text-foreground/70 hover:text-foreground/80'
          )}
          key={opt}
          onClick={() => onChange(opt)}
          title={`Use ${opt}`}
          type="button"
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
