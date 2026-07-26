/**
 * TimerStep — Stage 2 active-timer shell (§4.1, "Active timer").
 *
 * Renders a wrapped `<Timer>` (the existing widget from
 * `src/renderer/src/components/Timer.tsx`) plus a "Stir now"
 * alert that fires when the optional `stirIntervalSeconds`
 * elapses.
 *
 * Week 2 (this commit): the shell accepts the prop contract
 * and renders the wrapped Timer + the Stir alert affordance.
 * The actual data wiring — pre-filling the Timer from the
 * Stage 1 selection, syncing timer state across the stepper,
 * and triggering real "stir" reminders — lands in week 4.
 * For now the underlying `Timer` widget reads from the
 * `appStore` (its existing behavior); the shell renders the
 * Stir alert based on a fake elapsed-time check driven by
 * the component's mount time. (The alert appearance logic
 * is intentionally simple — week 4 will replace it with the
 * real engine-driven timer state.)
 */
import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { TimerWidget } from '../Timer'

export interface TimerStepProps {
  /** Total run time in seconds. Used to pre-fill the Timer
   *  widget's display when the integration lands in week 4. */
  totalSeconds: number
  /** Optional. When set, a "Stir now" alert appears once this
   *  many seconds have elapsed since the step's mount. Mirrors
   *  the §4.1 "Stir now" alert affordance. */
  stirIntervalSeconds?: number
  /** Fired when the user signals the timer is done (e.g. taps
   *  the wrapped Timer's "Done" indicator). For week 2 this
   *  is informational — the stepper's "Mark complete" CTA is
   *  the canonical advance path. */
  onComplete: () => void
}

export function TimerStep({
  totalSeconds,
  stirIntervalSeconds,
  onComplete,
}: TimerStepProps) {
  // -- Stir alert state. -------------------------------------------
  // Week 2 placeholder: a simple "elapsed since mount" timer
  // that fires once `stirIntervalSeconds` is reached. The real
  // implementation in week 4 will read from the engine-driven
  // timer state, not a local interval.
  const mountedAtRef = useRef<number>(Date.now())
  const [stirAlertVisible, setStirAlertVisible] = useState(false)
  useEffect(() => {
    if (stirIntervalSeconds == null || stirIntervalSeconds <= 0) return
    const id = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - mountedAtRef.current) / 1000)
      if (elapsedSec >= stirIntervalSeconds) {
        setStirAlertVisible(true)
        // One-shot — clear the interval once the alert fires.
        clearInterval(id)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [stirIntervalSeconds])
  // We deliberately ignore `onComplete` in week 2 — the wrapped
  // TimerWidget has its own done state, but wiring it through
  // requires week 4 work. The prop is accepted so the type is
  // stable and week-4 callers don't change the API.
  void onComplete
  return (
    <div
      className="flex flex-col gap-2"
      data-testid="timer-step"
      data-total-seconds={totalSeconds}
    >
      {/* Stir alert — shown above the timer so the user sees
          it immediately when it fires. Styled with the existing
          warning/border tokens (no globals.css change). */}
      {stirAlertVisible ? (
        <div
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning"
          data-testid="timer-step-stir-alert"
          role="status"
        >
          <Bell aria-hidden="true" className="size-3.5" />
          Stir now
        </div>
      ) : null}

      {/* The wrapped Timer widget. The widget is global (reads
          from appStore) — for week 2 it's rendered as-is. The
          prop contract on this shell is the integration point
          that week 4 will use to drive the widget's state. */}
      <TimerWidget />

      {/* Informational caption so the shell's `totalSeconds`
          prop is observable in tests without rendering the
          underlying widget's deep internals. */}
      <p
        className="text-[11px] text-foreground/50"
        data-testid="timer-step-total"
      >
        Configured for {formatDuration(totalSeconds)} total
      </p>
    </div>
  )
}

/** Convert seconds to a human-readable duration like "45m" or
 *  "1h 15m". Used by the informational caption. */
function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0m'
  const totalMin = Math.round(totalSeconds / 60)
  if (totalMin < 60) return `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
