/**
 * Wizard feature flag — `wizardEnabled` reads the store defensively.
 *
 * The `wizardEnabled` flag + the new `wizard` slice are owned by the
 * state-routing rein. Their slice lands in a parallel commit (per
 * the wire-up memory, the ui-tabs and state-routing commits must
 * land independently). The state-routing slice is NOT YET on
 * master at the time of this writing — `useAppStore.getState()`
 * has no `wizardEnabled` field.
 *
 * To stay type-safe + tolerant, this module reads the field with a
 * type cast. When state-routing lands:
 *   - If they ship `wizardEnabled: boolean` on the store, this hook
 *     reads it directly. Same behavior.
 *   - If they ship a different name, this hook is the only edit
 *     point — the rest of the wizard imports `useWizardEnabled`
 *     from here, not the store.
 *
 * Default is `false` (hidden). The WizardScreen is a no-op until
 * the flag flips. Existing users see no change.
 */
import { useAppStore } from 'renderer/src/stores/appStore'

/**
 * Read the `wizardEnabled` flag defensively. Returns `false` when
 * the field is absent (pre-state-routing-merge).
 *
 * The cast `as unknown as { wizardEnabled?: boolean }` keeps
 * typecheck clean today and auto-resolves once state-routing lands
 * the real field (TypeScript will accept the field access at
 * runtime regardless of whether the type has been widened; this
 * hook is the only place that needs the cast).
 */
export function useWizardEnabled(): boolean {
  return useAppStore(s => {
    const candidate = s as unknown as { wizardEnabled?: boolean }
    return candidate.wizardEnabled === true
  })
}

/**
 * Imperative read for code paths that don't have a React context
 * (e.g. test setup, non-component code). Mirrors `useWizardEnabled`.
 */
export function readWizardEnabled(): boolean {
  const state = useAppStore.getState() as unknown as {
    wizardEnabled?: boolean
  }
  return state.wizardEnabled === true
}
