import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
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
  // 2026-07-26 P5 — Timer pre-fills from the active decarb
  // preset. If `decarb.presetId` matches a `DECARB_METHODS` entry,
  // the Timer highlights that method's start button (and shows
  // only that method's row when the active preset is set, per the
  // brief's "If a preset is active, only show that method's start
  // button" interpretation). If no preset is active, all methods
  // are listed as before.
  const decarbPresetId = useAppStore(s => s.decarb.presetId)
  const [collapsed, setCollapsed] = useState(true)
  const [customMinutes, setCustomMinutes] = useState('')
  const [remaining, setRemaining] = useState(0)
  const [alertVisible, setAlertVisible] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // The active preset (or null if `decarb.presetId` doesn't match a
  // known method). Used to filter / highlight the method buttons.
  const activeMethod = useMemo(
    () => DECARB_METHODS.find(m => m.id === decarbPresetId) ?? null,
    [decarbPresetId]
  )

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
          'border-2 border-warning/50 bg-warning/10 dark:bg-warning/10'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <TimerIcon aria-hidden="true" className="size-4 text-foreground/70" />
          <span className="text-sm font-semibold text-foreground">
            {timer.active
              ? `Timer -- ${timer.methodName}`
              : alertVisible
                ? 'Timer Complete'
                : 'Timer'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {timer.active && (
            <span className="text-lg font-bold tabular-nums text-foreground">
              {formatTime(remaining)}
            </span>
          )}
          {alertVisible && (
            <span
              className="flex items-center gap-1 text-sm font-bold text-warning dark:text-warning"
              role="status"
            >
              <Bell aria-hidden="true" className="size-4" />
              Done
            </span>
          )}
          <button
            aria-expanded={!collapsed}
            aria-label={
              collapsed ? 'Show timer controls' : 'Hide timer controls'
            }
            className="inline-flex items-center rounded-lg border border-foreground/20 bg-foreground/5 px-2 py-1 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={() => setCollapsed(v => !v)}
            type="button"
          >
            {collapsed ? (
              <ChevronDown aria-hidden="true" className="size-3.5" />
            ) : (
              <ChevronUp aria-hidden="true" className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-4 flex flex-col gap-3">
          {/* 2026-07-26 P5 — Preset buttons. When an active decarb
              preset is set (decarb.presetId matches a DECARB_METHODS
              entry), the timer shows ONLY that method's start
              button (highlighted as the default). When no preset is
              active, the timer falls back to listing all methods
              as before. The brief's "highlight it as the default"
              clause is implemented as the conditional render (the
              active method's button is the only one in the grid). */}
          {activeMethod && (
            <p
              className="rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-xs leading-relaxed text-info"
              data-testid="timer-active-preset-callout"
            >
              <strong className="font-semibold">
                {activeMethod.name}
              </strong>{' '}
              is selected on the Decarb tab — the timer is pre-set
              to its recommended time. You can still start any
              other method below.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(activeMethod ? [activeMethod] : DECARB_METHODS).map(
              method => (
                <button
                  className={
                    activeMethod
                      ? 'inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-info/60 bg-info/10 px-2 py-2 text-xs font-semibold text-info transition-colors hover:bg-info/20'
                      : 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-2 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground'
                  }
                  data-testid={
                    activeMethod
                      ? `timer-preset-${method.id}`
                      : `timer-preset-${method.id}`
                  }
                  key={method.id}
                  onClick={() => handlePresetStart(method.id)}
                  type="button"
                >
                  <Play aria-hidden="true" className="size-3" />
                  {method.name}
                  <span className="text-foreground/70">
                    ({method.timeMax}m)
                  </span>
                </button>
              )
            )}
          </div>

          {/* Custom timer */}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <input
              aria-label="Custom timer minutes"
              className="min-w-[8rem] flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
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
              <Play aria-hidden="true" className="size-3" />
              Start
            </button>
          </div>

          {/* Stop button */}
          {(timer.active || alertVisible) && (
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger/20"
              onClick={stopTimer}
              type="button"
            >
              <Square aria-hidden="true" className="size-3" />
              Stop / Reset
            </button>
          )}
        </div>
      )}
    </div>
  )
}
