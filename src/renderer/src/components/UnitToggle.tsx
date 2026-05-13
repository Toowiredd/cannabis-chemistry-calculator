import { cn } from 'renderer/lib/utils'

interface UnitToggleProps<T extends string> {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
}

export function UnitToggle<T extends string>({
  value,
  options,
  onChange,
}: UnitToggleProps<T>) {
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-foreground/20 bg-foreground/5 p-0.5">
      {options.map(opt => (
        <button
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            value === opt
              ? 'bg-foreground/15 text-foreground'
              : 'text-foreground/70 hover:text-foreground/80'
          )}
          key={opt}
          onClick={() => onChange(opt)}
          type="button"
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
