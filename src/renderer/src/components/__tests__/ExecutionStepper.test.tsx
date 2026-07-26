/**
 * Tests for the ExecutionStepper container component.
 *
 * ExecutionStepper is the Stage 2 vertical stepper shell (per
 * the architecture doc §4.2). For Week 2 it accepts the
 * `ExecutionStep[]` + `selections` props and renders the
 * progress bar, phase grouping, current-step highlight, and
 * mark-complete CTA. The actual data wiring lands in weeks 3-4.
 *
 * Coverage:
 *  - renders the stepper with the progress bar + step rows
 *  - the current step is visually marked (data-state="current"
 *    + a "Current" badge)
 *  - tapping "Mark complete" calls onComplete with the stepId
 *  - the progress bar reflects the current step index
 *    (completedCount / totalCount → aria-valuenow)
 *  - completed steps collapse to a compact summary
 *  - steps with `skipIf` returning true are hidden entirely
 *  - "Back to config" calls onBack
 *  - the optional "Skip" CTA only renders for steps with a
 *    `skipIf` predicate, and tapping it calls onSkip
 *  - the empty-state renders when every step is skipped
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ExecutionStepper, type ExecutionStep } from '../ExecutionStepper'
import { DEFAULT_WIZARD_STATE } from 'renderer/src/wizard/wizardTypes'

/* -- Mock useReducedMotion so each test can flip the flag. ----------
 * The default is `false` (motion enabled) so the existing tests
 * behave exactly as before. The a11y tests flip it to `true` to
 * assert the gates. `vi.hoisted` shares the mutable `mockMotion`
 * object with the hoisted `vi.mock` factory. */
const { mockMotion } = vi.hoisted(() => ({ mockMotion: { value: false } }))
vi.mock('renderer/src/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockMotion.value,
}))

/* -- Test fixtures -------------------------------------------------- */

const baseSteps: ExecutionStep[] = [
  {
    id: 'preheat',
    title: 'Preheat',
    phase: 'decarb',
    shell: 'preheat',
    targetTemp: 105,
    duration: '45 min',
    isComplete: false,
    isCurrent: true,
  },
  {
    id: 'timer',
    title: 'Decarb timer',
    phase: 'decarb',
    shell: 'timer',
    totalSeconds: 2700,
    stirIntervalSeconds: 900,
    isComplete: false,
    isCurrent: false,
  },
  {
    id: 'heatmap',
    title: 'Material state',
    phase: 'decarb',
    shell: 'heatmap',
    targetTemp: 105,
    currentTemp: 90,
    progressPct: 50,
    material: 'flower',
    isComplete: false,
    isCurrent: false,
  },
  {
    id: 'transition',
    title: 'Move to infusion',
    phase: 'transition',
    shell: 'transition',
    message: 'Move to infusion →',
    isComplete: false,
    isCurrent: false,
  },
  {
    id: 'completion',
    title: 'Batch complete',
    phase: 'completion',
    shell: 'completion',
    recipeName: 'Test recipe',
    computedTotals: { thcMg: 142, cbdMg: 8, servings: 12 },
    isComplete: false,
    isCurrent: false,
  },
]

/* -- Tests ---------------------------------------------------------- */

beforeEach(() => {
  mockMotion.value = false
})

describe('ExecutionStepper — render', () => {
  it('renders the stepper with a progress bar + step rows', () => {
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={baseSteps}
      />
    )
    expect(screen.getByTestId('execution-stepper')).toBeTruthy()
    expect(screen.getByTestId('execution-stepper-header')).toBeTruthy()
    expect(screen.getByTestId('execution-stepper-progress')).toBeTruthy()
    // All five steps are present.
    expect(screen.getByTestId('execution-step-preheat')).toBeTruthy()
    expect(screen.getByTestId('execution-step-timer')).toBeTruthy()
    expect(screen.getByTestId('execution-step-heatmap')).toBeTruthy()
    expect(screen.getByTestId('execution-step-transition')).toBeTruthy()
    expect(screen.getByTestId('execution-step-completion')).toBeTruthy()
  })
})

describe('ExecutionStepper — current step', () => {
  it('marks the current step with data-state="current" + a "Current" badge', () => {
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={baseSteps}
      />
    )
    const current = screen.getByTestId('execution-step-preheat')
    expect(current.getAttribute('data-state')).toBe('current')
    expect(
      screen.getByTestId('execution-step-preheat-badge-current')
    ).toBeTruthy()
  })

  it('non-current steps render with data-state="pending" and no badge', () => {
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={baseSteps}
      />
    )
    const pending = screen.getByTestId('execution-step-timer')
    expect(pending.getAttribute('data-state')).toBe('pending')
    expect(
      screen.queryByTestId('execution-step-timer-badge-current')
    ).toBeNull()
  })
})

describe('ExecutionStepper — Mark complete CTA', () => {
  it('tapping "Mark complete" calls onComplete with the right stepId', () => {
    const onComplete = vi.fn()
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={onComplete}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={baseSteps}
      />
    )
    fireEvent.click(screen.getByTestId('execution-step-preheat-complete'))
    expect(onComplete).toHaveBeenCalledWith('preheat')
  })

  it('every step renders a "Mark complete" CTA', () => {
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={baseSteps}
      />
    )
    for (const step of baseSteps) {
      expect(
        screen.getByTestId(`execution-step-${step.id}-complete`)
      ).toBeTruthy()
    }
  })
})

describe('ExecutionStepper — progress bar', () => {
  it('reflects the completedCount / totalCount in aria-valuenow', () => {
    const steps: ExecutionStep[] = baseSteps.map((s, i) => ({
      ...s,
      isComplete: i < 2,
      isCurrent: i === 2,
    }))
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={steps}
      />
    )
    // 2 of 5 complete = 40%.
    const progress = screen.getByTestId('execution-stepper-progress')
    expect(progress.getAttribute('aria-valuenow')).toBe('40')
    expect(
      screen.getByTestId('execution-stepper-progress-label').textContent
    ).toContain('2 of 5')
  })

  it('renders 0% when no step is complete', () => {
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={baseSteps}
      />
    )
    const progress = screen.getByTestId('execution-stepper-progress')
    expect(progress.getAttribute('aria-valuenow')).toBe('0')
  })
})

describe('ExecutionStepper — completed collapse', () => {
  it('completed steps render as compact summaries (not the full shell)', () => {
    const steps: ExecutionStep[] = baseSteps.map((s, i) => ({
      ...s,
      isComplete: i === 0,
      isCurrent: i === 1,
    }))
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={steps}
      />
    )
    // The completed preheat step renders as a summary, not a
    // full row.
    expect(screen.getByTestId('execution-step-preheat-complete')).toBeTruthy()
    expect(screen.queryByTestId('execution-step-preheat-shell')).toBeNull()
    // The current step (timer) renders as a full row.
    expect(screen.getByTestId('execution-step-timer-shell')).toBeTruthy()
  })
})

describe('ExecutionStepper — skipIf', () => {
  it('hides steps whose skipIf returns true', () => {
    const steps: ExecutionStep[] = [
      ...baseSteps,
      {
        id: 'extra-stir',
        title: 'Optional stir',
        phase: 'decarb',
        shell: 'timer',
        totalSeconds: 60,
        isComplete: false,
        isCurrent: false,
        skipIf: () => true,
      },
    ]
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={steps}
      />
    )
    expect(screen.queryByTestId('execution-step-extra-stir')).toBeNull()
  })

  it('shows steps whose skipIf returns false', () => {
    const steps: ExecutionStep[] = [
      ...baseSteps,
      {
        id: 'extra-stir',
        title: 'Optional stir',
        phase: 'decarb',
        shell: 'timer',
        totalSeconds: 60,
        isComplete: false,
        isCurrent: false,
        skipIf: () => false,
      },
    ]
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={steps}
      />
    )
    expect(screen.getByTestId('execution-step-extra-stir')).toBeTruthy()
  })

  it('renders the empty state when every step is skipped', () => {
    const steps: ExecutionStep[] = baseSteps.map(s => ({
      ...s,
      skipIf: () => true,
    }))
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={steps}
      />
    )
    expect(screen.getByText('No steps to run.')).toBeTruthy()
  })

  it('renders a Skip CTA for steps with a skipIf predicate; tapping it calls onSkip', () => {
    const onSkip = vi.fn()
    const preheatStep = baseSteps[0]
    if (!preheatStep) throw new Error('Test fixture missing preheat step')
    const steps: ExecutionStep[] = [
      {
        ...preheatStep,
        skipIf: () => false,
        isCurrent: true,
      },
    ]
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        onSkip={onSkip}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={steps}
      />
    )
    const skipBtn = screen.getByTestId('execution-step-preheat-skip')
    expect(skipBtn).toBeTruthy()
    fireEvent.click(skipBtn)
    expect(onSkip).toHaveBeenCalledWith('preheat')
  })

  it('does NOT render a Skip CTA for steps without a skipIf predicate', () => {
    const preheatStep = baseSteps[0]
    if (!preheatStep) throw new Error('Test fixture missing preheat step')
    const steps: ExecutionStep[] = [
      {
        ...preheatStep,
        isCurrent: true,
      },
    ]
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        onSkip={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={steps}
      />
    )
    expect(screen.queryByTestId('execution-step-preheat-skip')).toBeNull()
  })
})

describe('ExecutionStepper — Back to config', () => {
  it('tapping "Back to config" calls onBack', () => {
    const onBack = vi.fn()
    render(
      <ExecutionStepper
        onBack={onBack}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={baseSteps}
      />
    )
    fireEvent.click(screen.getByTestId('execution-stepper-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

/* -- Week 7 a11y polish ----------------------------------------------
 * Reduced-motion gating, focus rings, sr-only live region. */

describe('ExecutionStepper — a11y / reduced motion', () => {
  it('does NOT apply the `scale-[1.005]` transform to the current step when reduced motion is true', () => {
    mockMotion.value = true
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={baseSteps}
      />
    )
    const current = screen.getByTestId('execution-step-preheat')
    expect(current.className).not.toContain('scale-[1.005]')
    expect(current.className).not.toContain('transition-transform')
  })

  it('applies the `scale-[1.005]` transform to the current step when reduced motion is false (default)', () => {
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={baseSteps}
      />
    )
    const current = screen.getByTestId('execution-step-preheat')
    expect(current.className).toContain('scale-[1.005]')
  })

  it('does NOT apply the `toast-in` class to step rows when reduced motion is true', () => {
    mockMotion.value = true
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={baseSteps}
      />
    )
    // The stepper never applies `toast-in` to the row itself; the
    // gate is in TransitionStep. Confirm the contract: the row's
    // className has no animation class when reduced motion is on.
    for (const step of baseSteps) {
      const row = screen.getByTestId(`execution-step-${step.id}`)
      expect(row.className).not.toContain('toast-in')
    }
  })
})

describe('ExecutionStepper — a11y / focus rings', () => {
  it('"Back to config" button has a focus-visible:ring-* class set', () => {
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={baseSteps}
      />
    )
    const back = screen.getByTestId('execution-stepper-back')
    expect(back.className).toContain('focus-visible:ring-')
  })

  it('"Mark complete" button has a focus-visible:ring-* class set', () => {
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={baseSteps}
      />
    )
    const mark = screen.getByTestId('execution-step-preheat-complete')
    expect(mark.className).toContain('focus-visible:ring-')
  })

  it('"Skip" button has a focus-visible:ring-* class set', () => {
    const onSkip = vi.fn()
    const preheatStep = baseSteps[0]
    if (!preheatStep) throw new Error('Test fixture missing preheat step')
    const steps: ExecutionStep[] = [
      { ...preheatStep, skipIf: () => false, isCurrent: true },
    ]
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        onSkip={onSkip}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={steps}
      />
    )
    const skip = screen.getByTestId('execution-step-preheat-skip')
    expect(skip.className).toContain('focus-visible:ring-')
  })
})

describe('ExecutionStepper — a11y / sr-only live region', () => {
  it('has an sr-only aria-live="polite" region for step announcements', () => {
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={baseSteps}
      />
    )
    const announce = screen.getByTestId('execution-stepper-announce')
    expect(announce.getAttribute('aria-live')).toBe('polite')
    expect(announce.className).toContain('sr-only')
  })

  it('announces the current step title via the sr-only region', () => {
    render(
      <ExecutionStepper
        onBack={() => {}}
        onComplete={() => {}}
        selections={DEFAULT_WIZARD_STATE.selections}
        steps={baseSteps}
      />
    )
    // The useEffect runs synchronously in act(); the current
    // step is the first one (preheat, marked isCurrent: true).
    const announce = screen.getByTestId('execution-stepper-announce')
    expect(announce.textContent).toContain('Preheat')
  })
})
