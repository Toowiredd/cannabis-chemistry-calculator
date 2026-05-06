import { cn } from 'renderer/lib/utils'

export function Toast({
  message,
  visible,
}: {
  message: string | null
  visible: boolean
}) {
  if (!visible || !message) return null
  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 transform rounded-lg border border-white/20 bg-black/90 px-4 py-2 text-sm text-white shadow-xl transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      )}
    >
      {message}
    </div>
  )
}
