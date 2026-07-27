/**
 * Wizard flag reader — `wizardEnabled` reads the store directly.
 *
 * The wizard IS the canonical UI/UX. Default is `true` (the
 * recipe-style wizard is the primary surface: carousel landing →
 * equipment carousel → read-only "you'll need" → inline steps →
 * extraction timer → cooking timer → yield + save).
 *
 * The flag is a kill switch for the migration window, not a
 * user-facing opt-in. Existing users with the legacy persisted
 * `false` value are coerced to `true` on rehydrate (see the
 * migration block in `appStore.ts`).
 *
 * This module exists so the wizard imports `useWizardEnabled` /
 * `readWizardEnabled` from one place, not the store directly. If
 * the field is renamed or the gating logic changes, this is the
 * only edit point.
 */
import { useAppStore } from 'renderer/src/stores/appStore'

/**
 * Read the `wizardEnabled` flag from the typed store. Returns
 * `true` for new users (default) and for existing users whose
 * persisted `false` was coerced to `true` on rehydrate. Returns
 * `false` only when an existing user has explicitly toggled it
 * off (rare; the kill switch).
 */
export function useWizardEnabled(): boolean {
  return useAppStore(s => s.wizardEnabled === true)
}

/**
 * Imperative read for code paths that don't have a React context
 * (e.g. test setup, non-component code). Mirrors `useWizardEnabled`.
 */
export function readWizardEnabled(): boolean {
  return useAppStore.getState().wizardEnabled === true
}
