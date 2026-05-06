import { Minus, Square, X } from 'lucide-react'

function TitleBarButton({
  onClick,
  children,
  hoverClass,
}: {
  onClick: () => void
  children: React.ReactNode
  hoverClass?: string
}) {
  return (
    <button
      className={cn(
        'flex h-8 w-10 items-center justify-center text-white/80 transition-colors',
        hoverClass || 'hover:text-white'
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

import { cn } from 'renderer/lib/utils'

export function TitleBar() {
  return (
    <header className="app-region-drag flex h-10 shrink-0 items-center justify-between bg-black/40 px-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white/90">
          Cannabis Chemistry Calculator
        </span>
      </div>

      <div className="app-region-no-drag flex items-center">
        <TitleBarButton onClick={() => window.App.window.minimize()}>
          <Minus className="size-4" />
        </TitleBarButton>
        <TitleBarButton onClick={() => window.App.window.maximize()}>
          <Square className="size-3.5" />
        </TitleBarButton>
        <TitleBarButton
          hoverClass="hover:bg-red-600 hover:text-white"
          onClick={() => window.App.window.close()}
        >
          <X className="size-4" />
        </TitleBarButton>
      </div>
    </header>
  )
}
