import { cn } from 'renderer/lib/utils'
import type { ReactNode } from 'react'

export type GlassCardVariant = 'glass' | 'glass-strong' | 'glass-xl' | 'opaque'

export function GlassCard({
  children,
  className,
  variant = 'glass-strong',
  hover = false,
}: {
  children: ReactNode
  className?: string
  variant?: GlassCardVariant
  hover?: boolean
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-2xl p-4 sm:p-6',
        hover && 'card-hover',
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
