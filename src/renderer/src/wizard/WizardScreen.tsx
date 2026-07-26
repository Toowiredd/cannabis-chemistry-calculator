/**
 * WizardScreen — top-level screen that renders the Stage 1 wizard.
 *
 * Per the architecture doc §7 Week 1 scope:
 *  - Behind a `wizardEnabled` feature flag (read via
 *    `useWizardEnabled` from the wizardFeatureFlag module).
 *  - When the flag is off, renders nothing — the existing
 *    GroupedTabNav takes over.
 *  - When the flag is on, renders the Wizard container with the
 *    product-type step if `state.branch === null`, or the branch
 *    sequence if `state.branch !== null`.
 *  - For the Flower branch, only the Method step is fully
 *    implemented for Week 1. The §8.5 "Name this recipe" step is a
 *    placeholder text input (week 5 has the real save flow).
 *  - Includes a "Reset wizard" link at the bottom.
 *
 * State: held locally in this component for Week 1. Week 2+ will
 * migrate to the `appStore.wizard` slice owned by state-routing.
 * The `WizardState` shape (`wizard/wizardTypes.ts`) is the same,
 * so the migration is a 1-line change (replace `useState` with
 * `useAppStore(s => s.wizard)`).
 */
import { useCallback, useState } from 'react'
import { cn } from 'renderer/lib/utils'
import { RotateCcw } from 'lucide-react'
import { Wizard } from 'renderer/src/components/Wizard'
import { useWizardEnabled } from 'renderer/src/wizard/wizardFeatureFlag'
import {
  DEFAULT_WIZARD_STATE,
  type WizardBranchId,
  type WizardState,
} from 'renderer/src/wizard/wizardTypes'

export interface WizardScreenProps {
  className?: string
}

export function WizardScreen({ className }: WizardScreenProps) {
  // All hooks must be called unconditionally at the top of the
  // component (React rules of hooks). The `enabled` early return
  // happens AFTER every hook in this function.
  const enabled = useWizardEnabled()
  const [state, setState] = useState<WizardState>(DEFAULT_WIZARD_STATE)

  const onSelect = useCallback((stepId: string, optionId: string) => {
    setState(prev => {
      // Step 0 (product type) — the optionId is the branch id. Set
      // `branch` and advance to step 1.
      if (stepId === 'product-type') {
        return {
          ...prev,
          branch: optionId as WizardBranchId,
          currentStep: 1,
        }
      }
      // The Method step — set `selections.method` and advance to
      // step 2.
      if (stepId === 'method') {
        return {
          ...prev,
          currentStep: 2,
          selections: { ...prev.selections, method: optionId },
        }
      }
      // Future steps (week 2+). The option id is stored under the
      // matching key in `selections`; the Wizard consumer
      // determines which key.
      return prev
    })
  }, [])

  const onEdit = useCallback((stepId: string) => {
    setState(prev => {
      // Re-editing a step sets `currentStep` to that step's
      // index. Step 0 (product type) is index 0; Method is index 1.
      if (stepId === 'product-type') return { ...prev, currentStep: 0 }
      if (stepId === 'method') return { ...prev, currentStep: 1 }
      return prev
    })
  }, [])

  const onReset = useCallback(() => {
    setState(DEFAULT_WIZARD_STATE)
  }, [])

  // When the flag is off, render nothing. The existing
  // GroupedTabNav takes over. This early return is AFTER every
  // hook call above.
  if (!enabled) {
    return null
  }

  return (
    <div
      className={cn('flex w-full flex-col gap-4 p-2 sm:p-4', className)}
      data-testid="wizard-screen"
    >
      {/* Header — title + reset link. */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-semibold text-foreground">
            Make a batch
          </h2>
          <p className="text-xs text-foreground/60">
            Answer a few questions and the calculator will set itself up.
          </p>
        </div>
        <button
          aria-label="Reset wizard"
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          data-testid="wizard-reset"
          onClick={onReset}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Reset wizard
        </button>
      </header>

      {/* The step stack — collapses to nothing when the flag is off. */}
      <Wizard onEdit={onEdit} onSelect={onSelect} state={state} />

      {/* Week-1 placeholder for the §8.5 "Name this recipe" step.
          Shown after the user finishes the Flower branch's Method
          step. Full implementation lands in week 5 alongside
          `appStore.recipes[]`. */}
      {state.branch === 'flower' &&
      state.currentStep > 1 &&
      state.selections.method ? (
        <section
          aria-label="Name this recipe (placeholder)"
          className="flex flex-col gap-2 rounded-xl border border-dashed border-foreground/15 bg-foreground/5 p-4"
          data-testid="wizard-name-step-placeholder"
        >
          <h3 className="text-sm font-semibold text-foreground/80">
            Name this recipe
          </h3>
          <p className="text-xs text-foreground/60">
            Week 5 will save this recipe to your Journal with a name of your
            choice. For now, the wizard stops here.
          </p>
          <input
            aria-label="Recipe name (placeholder)"
            className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
            data-testid="wizard-name-input"
            disabled
            placeholder="e.g., Morning dose — 28g, oven-sealed"
            value={state.selections.name ?? ''}
          />
        </section>
      ) : null}
    </div>
  )
}
