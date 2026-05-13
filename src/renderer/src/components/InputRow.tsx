import { cn } from 'renderer/lib/utils'

interface InputRowProps {
  label: React.ReactNode
  children: React.ReactNode
  error?: string
  extraClass?: string
}

export function InputRow({ label, children, error, extraClass }: InputRowProps) {
  return (
    <div className={cn('flex flex-col gap-1', extraClass)}>
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
        {label}
      </span>
      {children}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
