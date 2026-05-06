import { cn } from 'renderer/lib/utils'
import type { ReactNode } from 'react'

export function GlassCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('glass-strong rounded-2xl p-6', className)}>
      {children}
    </div>
  )
}
