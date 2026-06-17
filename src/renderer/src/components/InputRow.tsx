import { cn } from 'renderer/lib/utils'
import type { ReactNode } from 'react'

interface InputRowProps {
  label: ReactNode
  children: ReactNode
  error?: string
  extraClass?: string
}

export function InputRow({
  label,
  children,
  error,
  extraClass,
}: InputRowProps) {
  return (
    <div className={cn('min-w-0 flex flex-col gap-1', extraClass)}>
      <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-medium text-foreground/80">
        {label}
      </span>
      {children}
      {error && (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
