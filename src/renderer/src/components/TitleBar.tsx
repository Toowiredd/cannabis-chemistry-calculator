import { Minus, Square, X, Sun, Moon } from 'lucide-react'
import { cn } from 'renderer/lib/utils'
import { PresetActions } from './PresetActions'
import { useAppStore } from 'renderer/src/stores/appStore'
import type { ReactNode } from 'react'

function TitleBarButton({
  onClick,
  children,
  hoverClass,
  label,
}: {
  onClick: () => void
  children: ReactNode
  hoverClass?: string
  label: string
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        'flex h-8 w-10 items-center justify-center text-foreground/80 transition-colors',
        hoverClass || 'hover:text-foreground'
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  )
}

export function TitleBar() {
  const theme = useAppStore(s => s.theme)
  const toggleTheme = useAppStore(s => s.toggleTheme)

  return (
    <header className="app-region-drag flex h-10 shrink-0 items-center justify-between gap-2 bg-foreground/10 px-2 backdrop-blur-md border-b border-foreground/10 sm:px-4">
      <div className="min-w-0 flex items-center gap-2">
        <span className="truncate text-sm font-semibold text-foreground/90">
          Cannabis Chemistry Calculator
        </span>
      </div>

      <div className="app-region-no-drag flex shrink-0 items-center gap-1.5 sm:gap-3">
        <PresetActions />

        <button
          aria-label={
            theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
          }
          className="flex h-8 w-10 items-center justify-center text-foreground/80 transition-colors hover:text-foreground"
          onClick={toggleTheme}
          title={
            theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
          }
          type="button"
        >
          {theme === 'dark' ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </button>

        <div className="flex items-center">
          <TitleBarButton
            label="Minimize window"
            onClick={() => window.App.window.minimize()}
          >
            <Minus aria-hidden="true" className="size-4" />
          </TitleBarButton>
          <TitleBarButton
            label="Maximize window"
            onClick={() => window.App.window.maximize()}
          >
            <Square aria-hidden="true" className="size-3.5" />
          </TitleBarButton>
          <TitleBarButton
            hoverClass="hover:bg-danger hover:text-foreground"
            label="Close window"
            onClick={() => window.App.window.close()}
          >
            <X aria-hidden="true" className="size-4" />
          </TitleBarButton>
        </div>
      </div>
    </header>
  )
}
