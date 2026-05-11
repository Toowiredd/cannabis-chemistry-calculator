import { Minus, Square, X, Sun, Moon } from 'lucide-react'
import { cn } from 'renderer/lib/utils'
import { PresetActions } from './PresetActions'
import { useAppStore } from 'renderer/src/stores/appStore'

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
        'flex h-8 w-10 items-center justify-center text-foreground/80 transition-colors',
        hoverClass || 'hover:text-foreground'
      )}
      onClick={onClick}
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
    <header className="app-region-drag flex h-10 shrink-0 items-center justify-between bg-foreground/10 px-4 backdrop-blur-md border-b border-foreground/10">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground/90">
          Cannabis Chemistry Calculator
        </span>
      </div>

      <div className="app-region-no-drag flex items-center gap-3">
        <PresetActions />

        <button
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
          <TitleBarButton onClick={() => window.App.window.minimize()}>
            <Minus className="size-4" />
          </TitleBarButton>
          <TitleBarButton onClick={() => window.App.window.maximize()}>
            <Square className="size-3.5" />
          </TitleBarButton>
          <TitleBarButton
            hoverClass="hover:bg-danger hover:text-foreground"
            onClick={() => window.App.window.close()}
          >
            <X className="size-4" />
          </TitleBarButton>
        </div>
      </div>
    </header>
  )
}
