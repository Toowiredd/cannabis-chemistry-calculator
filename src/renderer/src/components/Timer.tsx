import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import { DECARB_METHODS } from 'renderer/src/engine/models'
import { cn } from 'renderer/lib/utils'
import {
  Timer as TimerIcon,
  Play,
  Square,
  Bell,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function TimerWidget() {
  const timer = useAppStore(s => s.timer)
  const setTimer = useAppStore(s => s.setTimer)
  const resetTimer = useAppStore(s => s.resetTimer)
  const [collapsed, setCollapsed] = useState(true)
  const [customMinutes, setCustomMinutes] = useState('')
  const [remaining, setRemaining] = useState(0)
  const [alertVisible, setAlertVisible] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = useCallback(
    (totalSeconds: number, methodName: string) => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      const endTime = Date.now() + totalSeconds * 1000
      setTimer({
        active: true,
        endTime,
        totalSeconds,
        methodName,
      })
      setRemaining(totalSeconds)
      setAlertVisible(false)
    },
    [setTimer]
  )

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    resetTimer()
    setRemaining(0)
    setAlertVisible(false)
  }, [resetTimer])

  useEffect(() => {
    if (!timer.active || timer.endTime == null) return

    const end = timer.endTime

    const tick = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        setAlertVisible(true)
        setTimer({ active: false, endTime: null })
      }
    }

    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [timer.active, timer.endTime, setTimer])

  const handleCustomStart = () => {
    const mins = parseFloat(customMinutes)
    if (!Number.isNaN(mins) && mins > 0) {
      startTimer(Math.round(mins * 60), 'Custom')
      setCollapsed(true)
    }
  }

  const handlePresetStart = (methodId: string) => {
    const method = DECARB_METHODS.find(m => m.id === methodId)
    if (!method) return
    const seconds = Math.round(method.timeMax * 60)
    startTimer(seconds, method.name)
    setCollapsed(true)
  }

  return (
    <div
      className={cn(
        'glass-strong rounded-2xl p-4 transition-all',
        alertVisible &&
          'border-2 border-amber-400/50 bg-amber-100 dark:bg-amber-400/10'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TimerIcon className="size-4 text-foreground/70" />
          <span className="text-sm font-semibold text-foreground">
            {timer.active
              ? `Timer -- ${timer.methodName}`
              : alertVisible
                ? 'Timer Complete'
                : 'Timer'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {timer.active && (
            <span className="text-lg font-bold tabular-nums text-foreground">
              {formatTime(remaining)}
            </span>
          )}
          {alertVisible && (
            <span className="flex items-center gap-1 text-sm font-bold text-amber-700 dark:text-amber-300">
              <Bell className="size-4" />
              Done
            </span>
          )}
          <button
            className="inline-flex items-center rounded-lg border border-foreground/20 bg-foreground/5 px-2 py-1 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={() => setCollapsed(v => !v)}
            type="button"
          >
            {collapsed ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronUp className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-4 flex flex-col gap-3">
          {/* Preset buttons */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DECARB_METHODS.map(method => (
              <button
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-2 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
                key={method.id}
                onClick={() => handlePresetStart(method.id)}
                type="button"
              >
                <Play className="size-3" />
                {method.name}
                <span className="text-foreground/50">({method.timeMax}m)</span>
              </button>
            ))}
          </div>

          {/* Custom timer */}
          <div className="flex items-center gap-2">
            <input
              className="flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
              onChange={e => setCustomMinutes(e.target.value)}
              placeholder="Custom minutes"
              step="1"
              type="number"
              value={customMinutes}
            />
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
              onClick={handleCustomStart}
              type="button"
            >
              <Play className="size-3" />
              Start
            </button>
          </div>

          {/* Stop button */}
          {(timer.active || alertVisible) && (
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-400/20"
              onClick={stopTimer}
              type="button"
            >
              <Square className="size-3" />
              Stop / Reset
            </button>
          )}
        </div>
      )}
    </div>
  )
}
