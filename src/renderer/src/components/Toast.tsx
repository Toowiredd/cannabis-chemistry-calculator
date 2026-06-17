import { cn } from 'renderer/lib/utils'
import type { ReactNode } from 'react'
import { Check, AlertTriangle, AlertCircle, Info } from 'lucide-react'

export type ToastVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface ToastProps {
  message: ReactNode
  visible: boolean
  variant?: ToastVariant
  icon?: ReactNode
}

const variantIcon: Record<ToastVariant, ReactNode> = {
  default: null,
  success: <Check className="size-4 text-success" />,
  warning: <AlertTriangle className="size-4 text-warning" />,
  danger: <AlertCircle className="size-4 text-danger" />,
  info: <Info className="size-4 text-info" />,
}

const variantBorder: Record<ToastVariant, string> = {
  default: 'border-foreground/20',
  success: 'border-success/40',
  warning: 'border-warning/40',
  danger: 'border-danger/40',
  info: 'border-info/40',
}

const variantBg: Record<ToastVariant, string> = {
  default: 'bg-card',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  danger: 'bg-danger/10',
  info: 'bg-info/10',
}

export function Toast({
  message,
  visible,
  variant = 'default',
  icon,
}: ToastProps) {
  if (!message) return null

  const displayIcon = icon ?? variantIcon[variant]
  const borderClass = variantBorder[variant]
  const bgClass = variantBg[variant]
  const isAlert = variant === 'danger' || variant === 'warning'

  return (
    <div
      aria-live={isAlert ? 'assertive' : 'polite'}
      className={cn(
        'fixed bottom-6 left-1/2 z-[100] w-max max-w-[90vw] rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md',
        borderClass,
        bgClass,
        'flex items-center gap-2.5 text-sm text-foreground',
        visible ? 'toast-in' : 'toast-out'
      )}
      role={isAlert ? 'alert' : 'status'}
    >
      {displayIcon && (
        <span aria-hidden="true" className="shrink-0">
          {displayIcon}
        </span>
      )}
      <span className="font-medium">{message}</span>
    </div>
  )
}
