import { cn } from 'renderer/lib/utils'
import type { ReactNode } from 'react'

export type GlassCardVariant = 'glass' | 'glass-strong' | 'glass-xl' | 'opaque'

export function GlassCard({
  children,
  className,
  variant = 'glass-strong',
}: {
  children: ReactNode
  className?: string
  variant?: GlassCardVariant
}) {
  return (
    <div
      className={cn(
        'rounded-2xl p-6',
        variant === 'glass' && 'glass',
        variant === 'glass-strong' && 'glass-strong',
        variant === 'glass-xl' && 'glass-xl',
        variant === 'opaque' &&
          'bg-white/80 dark:bg-white/10 border border-border/60',
        className
      )}
    >
      {children}
    </div>
  )
}
