/**
 * ExecutionStepper — the Stage 2 vertical stepper container.
 *
 * Per the architecture doc §4.2 (docs/wizard-architecture-2026-07-26.md):
 *  - All steps visible in a vertical list.
 *  - Current step highlighted (color, gentle scale).
 *  - Each step has its own "Mark complete" CTA.
 *  - Completed steps collapse to a compact summary.
 *  - For longer processes (10+ steps), steps are grouped by phase
 *    (Decarb / Infusion / Dose) and the current phase is expanded;
 *    previous phases collapse to their summary.
 *  - Progress bar at the top ("3 of 7 steps complete").
 *  - "Back to config" button at the top returns to Stage 1.
 *  - "Skip" allowed only for steps with a `skipIf` predicate.
 *
 * Week 2 (this commit) ships the structural skeleton: the stepper
 * accepts the `ExecutionStep[]` + `selections` props and renders the
 * progress bar, phase grouping, current-step highlight, mark-complete
 * CTA, and skip button (where applicable). The actual data wiring
 * (engine integration, real timer state, real heatmap updates) lands
 * in weeks 3-4 — for now each step's shell is rendered with
 * placeholder/prop-driven content from the step itself.
 *
 * The stepper does NOT modify the existing `Timer.tsx` widget or
 * the `DecarbHeatmap.tsx` widget — those are wrapped by the
 * `TimerStep` and `HeatmapStep` shells respectively. The stepper
 * itself only routes: per `step.shell` it renders the matching
 * `<PreheatStep>` / `<TimerStep>` / `<HeatmapStep>` /
 * `<TransitionStep>` / `<CompletionStep>` component.
 */
import { useCallback, useId, useMemo } from 'react'
import { ArrowLeft, Check, ChevronRight, SkipForward } from 'lucide-react'
import { cn } from 'renderer/lib/utils'
import type { WizardSelections } from 'renderer/src/wizard/wizardTypes'
import { GlassCard } from './GlassCard'
import { CompletionStep } from './execution/CompletionStep'
import { HeatmapStep } from './execution/HeatmapStep'
import { PreheatStep } from './execution/PreheatStep'
import { TimerStep } from './execution/TimerStep'
import { TransitionStep } from './execution/TransitionStep'

/* ------------------------------------------------------------------ */
/* Public types                                                       */
/* ------------------------------------------------------------------ */

export type ExecutionStepPhase =
  | 'decarb'
  | 'infusion'
  | 'dose'
  | 'transition'
  | 'completion'

export type ExecutionStepShell =
  | 'preheat'
  | 'timer'
  | 'heatmap'
  | 'transition'
  | 'completion'

/**
 * The material the heatmap is visualizing. Matches the
 * Stage 2 decarb/infusion step vocabulary.
 */
export type ExecutionMaterial = 'flower' | 'concentrate' | 'avb'

/**
 * One row in the stepper. Carries everything the stepper needs
 * to render its shell: a discriminator (`shell`) plus the
 * shell-specific data fields. The shells themselves accept only
 * the data they need — the stepper reads the fields off this
 * union and routes to the matching component.
 *
 * Week 2 note: the `*Step` data fields (`targetTemp`, `duration`,
 * etc.) are sourced from the Stage 1 `selections` once the
 * engine-wiring work lands in weeks 3-4. For now the WizardScreen
 * hands the stepper a fully-populated `steps` list at construction
 * time (placeholder values are fine — the shells render their own
 * prop-driven content).
 */
export type ExecutionStep = {
  id: string
  title: string
  phase: ExecutionStepPhase
  shell: ExecutionStepShell
  /** Optional predicate — if it returns `true`, the step is hidden
   * entirely from the list (used for smart-skip per §4.2). */
  skipIf?: (selections: WizardSelections) => boolean
  isComplete: boolean
  isCurrent: boolean
  /* -- PreheatStep data -- */
  targetTemp?: number
  duration?: string
  /* -- TimerStep data -- */
  totalSeconds?: number
  stirIntervalSeconds?: number
  /* -- HeatmapStep data -- */
  currentTemp?: number
  progressPct?: number
  material?: ExecutionMaterial
  /* -- TransitionStep data -- */
  message?: string
  /* -- CompletionStep data -- */
  recipeName?: string
  computedTotals?: { thcMg: number; cbdMg: number; servings: number }
}

export interface ExecutionStepperProps {
  steps: ExecutionStep[]
  /** Stage 1 wizard selections. The `skipIf` predicate on each
   *  step is evaluated against this object. */
  selections: WizardSelections
  /** Fired when the user taps "Mark complete" on a step. The
   *  consumer (WizardScreen) is responsible for advancing the
   *  stepper's `currentIndex`. */
  onComplete: (stepId: string) => void
  /** Fired when the user taps "Back to config" — returns to
   *  Stage 1's last-active step. */
  onBack: () => void
  /** Optional. Fired when the user taps "Skip" on a skippable
   *  step. Steps without a `skipIf` predicate do NOT render a
   *  Skip button. */
  onSkip?: (stepId: string) => void
}

/* ------------------------------------------------------------------ */
/* Phase ordering                                                     */
/* ------------------------------------------------------------------ */

const PHASE_ORDER: ExecutionStepPhase[] = [
  'decarb',
  'infusion',
  'dose',
  'transition',
  'completion',
]

const PHASE_LABEL: Record<ExecutionStepPhase, string> = {
  decarb: 'Decarb',
  infusion: 'Infusion',
  dose: 'Dose',
  transition: 'Transition',
  completion: 'Finish',
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function ExecutionStepper({
  steps,
  selections,
  onComplete,
  onBack,
  onSkip,
}: ExecutionStepperProps) {
  const progressBarId = useId()
  // -- Filter: drop any step whose `skipIf` returns true. ----------
  const visibleSteps = useMemo(
    () => steps.filter(s => !s.skipIf?.(selections)),
    [steps, selections]
  )
  // -- Resolve the current step's index (for the progress bar). ----
  const currentIndex = useMemo(
    () => visibleSteps.findIndex(s => s.isCurrent),
    [visibleSteps]
  )
  const completedCount = useMemo(
    () => visibleSteps.filter(s => s.isComplete).length,
    [visibleSteps]
  )
  // -- Group visible steps by phase, preserving the input order. ---
  const groupedSteps = useMemo(() => groupByPhase(visibleSteps), [visibleSteps])
  // -- The "current" phase is the phase containing `currentIndex`. -
  const currentPhase = useMemo<ExecutionStepPhase | null>(() => {
    if (currentIndex < 0) return null
    return visibleSteps[currentIndex]?.phase ?? null
  }, [currentIndex, visibleSteps])

  // -- Stable callbacks for child shells. -------------------------
  const handleComplete = useCallback(
    (stepId: string) => onComplete(stepId),
    [onComplete]
  )
  const handleSkip = useCallback((stepId: string) => onSkip?.(stepId), [onSkip])

  // -- Defensive: empty state when every step is skipped. ---------
  if (visibleSteps.length === 0) {
    return (
      <section
        aria-label="Execution stepper"
        className="flex w-full flex-col gap-3"
        data-stage="execution"
        data-testid="execution-stepper"
      >
        <StepperHeader
          backDisabled={false}
          completedCount={0}
          onBack={onBack}
          progressBarId={progressBarId}
          totalCount={0}
        />
        <GlassCard
          className="flex flex-col items-center gap-2 text-center"
          data-testid="execution-stepper-empty"
        >
          <p className="text-sm font-medium text-foreground/80">
            No steps to run.
          </p>
          <p className="text-xs text-foreground/60">
            Every step was skipped for the current configuration.
          </p>
        </GlassCard>
      </section>
    )
  }

  return (
    <section
      aria-label="Execution stepper"
      className="flex w-full flex-col gap-3"
      data-stage="execution"
      data-testid="execution-stepper"
    >
      <StepperHeader
        backDisabled={false}
        completedCount={completedCount}
        onBack={onBack}
        progressBarId={progressBarId}
        totalCount={visibleSteps.length}
      />

      {/* -- Phase groups. The current phase is expanded; previous
           phases collapse to their phase summary. Future phases
           show their full step list as preview cards. ------------ */}
      <div
        className="flex flex-col gap-4"
        data-testid="execution-stepper-phases"
      >
        {PHASE_ORDER.map(phase => {
          const phaseSteps = groupedSteps.get(phase)
          if (!phaseSteps || phaseSteps.length === 0) return null
          const phaseComplete = phaseSteps.every(s => s.isComplete)
          const isCurrentPhase = phase === currentPhase
          // Previous phases (i.e. all their steps are complete and
          // they are NOT the current phase) collapse to the
          // summary. The current phase and any future phase
          // expand fully.
          const shouldCollapse = phaseComplete && !isCurrentPhase
          return (
            <PhaseGroup
              completedCount={phaseSteps.filter(s => s.isComplete).length}
              isCollapsed={shouldCollapse}
              isCurrent={isCurrentPhase}
              key={phase}
              onComplete={handleComplete}
              onSkip={onSkip ? handleSkip : undefined}
              phase={phase}
              steps={phaseSteps}
              totalCount={phaseSteps.length}
            />
          )
        })}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Stepper header (progress bar + Back to config)                     */
/* ------------------------------------------------------------------ */

function StepperHeader({
  backDisabled,
  completedCount,
  onBack,
  progressBarId,
  totalCount,
}: {
  backDisabled: boolean
  completedCount: number
  onBack: () => void
  progressBarId: string
  totalCount: number
}) {
  const pct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  return (
    <header
      className="flex flex-col gap-2"
      data-testid="execution-stepper-header"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          aria-label="Back to configuration"
          className={cn(
            'inline-flex items-center gap-1 rounded-lg border border-foreground/20 bg-foreground/5 px-2.5 py-1.5 text-xs font-medium text-foreground/80 transition-colors',
            'hover:bg-foreground/10 hover:text-foreground',
            backDisabled && 'opacity-50 pointer-events-none'
          )}
          data-testid="execution-stepper-back"
          disabled={backDisabled}
          onClick={onBack}
          type="button"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Back to config
        </button>
        <span
          aria-live="polite"
          className="text-xs font-medium text-foreground/60"
          data-testid="execution-stepper-progress-label"
        >
          {completedCount} of {totalCount} {totalCount === 1 ? 'step' : 'steps'}{' '}
          complete
        </span>
      </div>
      <div
        aria-label="Execution progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={pct}
        className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
        data-testid="execution-stepper-progress"
        id={progressBarId}
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          data-testid="execution-stepper-progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Phase group (collapsible)                                          */
/* ------------------------------------------------------------------ */

function PhaseGroup({
  completedCount,
  isCollapsed,
  isCurrent,
  onComplete,
  onSkip,
  phase,
  steps,
  totalCount,
}: {
  completedCount: number
  isCollapsed: boolean
  isCurrent: boolean
  onComplete: (stepId: string) => void
  onSkip?: (stepId: string) => void
  phase: ExecutionStepPhase
  steps: ExecutionStep[]
  totalCount: number
}) {
  // Collapsed = phase is complete and the user is past it. Show
  // the phase label + count, no individual steps.
  if (isCollapsed) {
    return (
      <div
        className="rounded-xl border border-success/20 bg-success/5 p-3"
        data-testid={`execution-phase-${phase}-collapsed`}
      >
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-success/90">
            <Check aria-hidden="true" className="size-3.5" />
            {PHASE_LABEL[phase]} complete
          </span>
          <span className="text-foreground/60">
            {completedCount} of {totalCount}
          </span>
        </div>
      </div>
    )
  }

  return (
    <section
      aria-label={`${PHASE_LABEL[phase]} steps`}
      className="flex flex-col gap-2"
      data-testid={`execution-phase-${phase}`}
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <h2
          className={cn(
            'text-xs font-semibold uppercase tracking-wider',
            isCurrent ? 'text-accent' : 'text-foreground/60'
          )}
        >
          {PHASE_LABEL[phase]}
        </h2>
        <span className="text-[11px] text-foreground/50">
          {completedCount} of {totalCount}
        </span>
      </header>
      <ol className="flex flex-col gap-2">
        {steps.map(step => (
          <li key={step.id}>
            <ExecutionStepRow
              onComplete={onComplete}
              onSkip={onSkip}
              step={step}
            />
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Single step row                                                    */
/* ------------------------------------------------------------------ */

function ExecutionStepRow({
  step,
  onComplete,
  onSkip,
}: {
  step: ExecutionStep
  onComplete: (stepId: string) => void
  onSkip?: (stepId: string) => void
}) {
  // -- Completed: compact summary. ---------------------------------
  if (step.isComplete) {
    return (
      <article
        aria-label={`${step.title} complete`}
        className="rounded-xl border border-success/30 bg-success/10 px-3 py-2"
        data-testid={`execution-step-${step.id}-complete`}
      >
        <div className="flex items-center gap-2 text-xs">
          <Check
            aria-hidden="true"
            className="size-3.5 shrink-0 text-success"
          />
          <span className="truncate font-medium text-success/90">
            {step.title}
          </span>
        </div>
      </article>
    )
  }

  const isCurrent = step.isCurrent
  return (
    <article
      aria-current={isCurrent ? 'step' : undefined}
      className={cn(
        'flex flex-col gap-2',
        isCurrent && 'scale-[1.005] transition-transform'
      )}
      data-state={isCurrent ? 'current' : 'pending'}
      data-testid={`execution-step-${step.id}`}
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <h3
          className={cn(
            'flex items-center gap-1.5 text-sm font-semibold',
            isCurrent ? 'text-foreground' : 'text-foreground/60'
          )}
        >
          {isCurrent ? (
            <ChevronRight aria-hidden="true" className="size-4 text-accent" />
          ) : (
            <span
              aria-hidden="true"
              className="inline-block size-4 rounded-full border border-foreground/30"
            />
          )}
          {step.title}
        </h3>
        {isCurrent ? (
          <span
            className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent"
            data-testid={`execution-step-${step.id}-badge-current`}
          >
            Current
          </span>
        ) : null}
      </header>

      {/* -- The routed shell. ------------------------------------ */}
      <div data-testid={`execution-step-${step.id}-shell`}>
        {renderShell(step, onComplete)}
      </div>

      {/* -- Mark complete + (optional) Skip CTAs. ----------------- */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {step.skipIf && onSkip ? (
          <button
            aria-label={`Skip ${step.title}`}
            className="inline-flex items-center gap-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
            data-testid={`execution-step-${step.id}-skip`}
            onClick={() => onSkip(step.id)}
            type="button"
          >
            <SkipForward aria-hidden="true" className="size-3.5" />
            Skip
          </button>
        ) : null}
        <button
          aria-label={`Mark ${step.title} complete`}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            isCurrent
              ? 'bg-accent/25 text-foreground hover:bg-accent/35'
              : 'bg-foreground/10 text-foreground/70 hover:bg-foreground/15'
          )}
          data-testid={`execution-step-${step.id}-complete`}
          onClick={() => onComplete(step.id)}
          type="button"
        >
          <Check aria-hidden="true" className="size-3.5" />
          Mark complete
        </button>
      </div>

      {/* Visual affordance for the current step — a small ring
          marker on the left so the user can scan-find their
          position in the list without reading every header. */}
      {isCurrent ? (
        <div
          aria-hidden="true"
          className="-ml-2 h-0.5 w-12 rounded-full bg-accent/60"
        />
      ) : null}
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Shell routing                                                      */
/* ------------------------------------------------------------------ */

/** Route a step to its shell component. The stepper itself never
 *  holds any per-shell data — the step carries it and the shells
 *  accept only the fields they need. */
function renderShell(
  step: ExecutionStep,
  onComplete: (stepId: string) => void
) {
  switch (step.shell) {
    case 'preheat':
      return (
        <PreheatStep
          duration={step.duration ?? '—'}
          onReady={() => onComplete(step.id)}
          targetTemp={step.targetTemp ?? 0}
        />
      )
    case 'timer':
      return (
        <TimerStep
          onComplete={() => onComplete(step.id)}
          stirIntervalSeconds={step.stirIntervalSeconds}
          totalSeconds={step.totalSeconds ?? 0}
        />
      )
    case 'heatmap':
      return (
        <HeatmapStep
          currentTemp={step.currentTemp ?? 0}
          material={step.material ?? 'flower'}
          progressPct={step.progressPct ?? 0}
          targetTemp={step.targetTemp ?? 0}
        />
      )
    case 'transition':
      return (
        <TransitionStep
          message={step.message ?? ''}
          onContinue={() => onComplete(step.id)}
        />
      )
    case 'completion':
      return (
        <CompletionStep
          computedTotals={
            step.computedTotals ?? { thcMg: 0, cbdMg: 0, servings: 0 }
          }
          onSave={() => onComplete(step.id)}
          recipeName={step.recipeName ?? ''}
        />
      )
  }
}

/* ------------------------------------------------------------------ */
/* Grouping helper                                                    */
/* ------------------------------------------------------------------ */

function groupByPhase(
  steps: ExecutionStep[]
): Map<ExecutionStepPhase, ExecutionStep[]> {
  const map = new Map<ExecutionStepPhase, ExecutionStep[]>()
  for (const step of steps) {
    const arr = map.get(step.phase) ?? []
    arr.push(step)
    map.set(step.phase, arr)
  }
  return map
}

/* The per-shell types (`ExecutionStepPhase`, `ExecutionStepShell`,
 * `ExecutionStep`, `ExecutionStepperProps`, `ExecutionMaterial`)
 * are all exported at the top of this file. Consumers can import
 * them directly from `./ExecutionStepper`. */
