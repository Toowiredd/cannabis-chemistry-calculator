import { useCallback, useEffect, useRef, useState } from 'react'
import { useModalA11y } from '../hooks/useModalA11y'
import {
  useAppStore,
  type AdvancedToolsState,
  type DecarbState,
  type DoseState,
  type InfusionState,
  type LabelState,
  type UnitPreferences,
} from 'renderer/src/stores/appStore'
import { Save, FolderOpen } from 'lucide-react'
import { Toast, type ToastVariant } from './Toast'
import { GlassCard } from './GlassCard'

/**
 * Shape of the preset payload that `window.App.savePreset` writes to
 * disk and `useAppStore.loadFromPreset` reads back. The 2026-07-25
 * ccc uiux-reviewer audit's B2 + B3 fixes widened this so the save /
 * load path is lossless for per-field units and for the bag / label /
 * advanced state that the prior narrow version dropped.
 *
 * The store's `loadFromPreset` (owned by the `state-routing` rein)
 * already understands every per-field unit (`weightUnit`,
 * `volumeUnit`, `tempOverrideUnit`, `bagWidthOverrideUnit`,
 * `bagLengthOverrideUnit`) and the full `decarb` / `infusion` / `dose`
 * shapes — so the round-trip works for those as long as the producer
 * (this file) writes them. `label` and `advancedTools` are
 * producer-side only for now; loading them is queued for the
 * `state-routing` schema widening that the audit's B1 fix is also
 * coordinating.
 */
export interface PresetPayload {
  /** Snapshot of display units (not per-field). */
  units: UnitPreferences
  /** Snapshot of the calculator slices — full shapes, not pruned. */
  tabs: {
    decarb: DecarbState
    infusion: InfusionState
    dose: DoseState
  }
  /** Snapshot of the Advanced Tools slice. */
  advancedTools: AdvancedToolsState
  /** Snapshot of the Label Generator slice. */
  label: LabelState
}

/**
 * Pure builder for the preset payload. Extracted as a standalone
 * function so the B2 / B3 regression tests in
 * `__tests__/PresetActions.test.tsx` can exercise the producer
 * side without mounting the React component. The component's
 * `buildPresetPayload` is a thin `useCallback` wrapper that calls
 * this with the current Zustand state.
 */
export function buildPresetPayloadFromState(state: {
  units: UnitPreferences
  decarb: DecarbState
  infusion: InfusionState
  dose: DoseState
  advancedTools: AdvancedToolsState
  label: LabelState
}): PresetPayload {
  return {
    units: { ...state.units },
    tabs: {
      // Full shape — including the per-field unit fields
      // (`weightUnit`, `tempOverrideUnit`, `bagWidthOverrideUnit`,
      // `bagLengthOverrideUnit`) and the bag / strain / material-mode
      // fields the old payload dropped.
      //
      // 2026-07-25 AVB feature round: the spread carries the
      // widened `materialMode: 'flower' | 'concentrate' | 'avb'`
      // and the AVB-specific `thcPct` (which doubles as the
      // residual-THC % in AVB mode). The state-routing agent
      // owns the schema widening; this producer is a thin
      // spread, so every persisted field round-trips without
      // an explicit allow-list. The `loadFromPreset` consumer
      // (in appStore.ts) guards each field with a literal-type
      // check, so a pre-v3 preset that lacks the widened
      // union falls back to the runtime default.
      decarb: { ...state.decarb },
      // Full shape — including the per-field `volumeUnit` (the old
      // payload dropped it, so 100 mL got re-interpreted as 100
      // display-units on load).
      infusion: { ...state.infusion },
      // Full shape — `formatId`, `reverseMode`, `desiredMgPerServing`
      // are part of the slice and the store reads them on load.
      dose: { ...state.dose },
    },
    // Advanced Tools sub-state — included for forward compatibility
    // even though the store's `loadFromPreset` doesn't yet read it
    // (state-routing owns that schema widening).
    advancedTools: {
      ...state.advancedTools,
      concentrate: { ...state.advancedTools.concentrate },
      blending: {
        ...state.advancedTools.blending,
        strains: state.advancedTools.blending.strains.map(s => ({ ...s })),
      },
      cost: { ...state.advancedTools.cost },
    },
    // Label Generator state — included for forward compatibility.
    label: { ...state.label },
  }
}

/**
 * Test-only entry point: reads the current Zustand state and runs
 * it through `buildPresetPayloadFromState`. The tests in
 * `__tests__/PresetActions.test.tsx` import this directly so they
 * can pin the payload contract without mounting React.
 */
export function buildPresetPayloadForTest(): PresetPayload {
  const state = useAppStore.getState()
  return buildPresetPayloadFromState({
    units: state.units,
    decarb: state.decarb,
    infusion: state.infusion,
    dose: state.dose,
    advancedTools: state.advancedTools,
    label: state.label,
  })
}

export function PresetActions() {
  const units = useAppStore(s => s.units)
  const decarb = useAppStore(s => s.decarb)
  const infusion = useAppStore(s => s.infusion)
  const dose = useAppStore(s => s.dose)
  const advancedTools = useAppStore(s => s.advancedTools)
  const label = useAppStore(s => s.label)
  const loadFromPreset = useAppStore(s => s.loadFromPreset)

  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastVariant, setToastVariant] = useState<ToastVariant>('default')
  const saveInputRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback(
    (msg: string, variant: ToastVariant = 'default') => {
      setToastMsg(msg)
      setToastVariant(variant)
      setToastVisible(true)
      setTimeout(() => setToastVisible(false), 2200)
    },
    []
  )

  const handleSaveCancel = () => {
    setShowSaveModal(false)
    setSaveName('')
    setSaveError(null)
  }

  useEffect(() => {
    if (showSaveModal && saveInputRef.current) {
      saveInputRef.current.focus()
    }
  }, [showSaveModal])

  const saveModalRef = useModalA11y(showSaveModal, handleSaveCancel)

  /**
   * Build the lossless preset payload.
   *
   * The prior version of this function only captured a handful of
   * calc-relevant fields and dropped the per-field units. Two
   * concrete bugs that fix this:
   *
   * - B2: a user who set `decarb.weightUnit = 'oz'` and `decarb.weight
   *   = '0.12'` then saved + loaded got a payload that read
   *   `units.weightUnit = 'oz'` but `decarb.weight = '0.12'` and no
   *   `decarb.weightUnit`. On load, the store defaulted `decarb.weightUnit`
   *   to `'g'`, so 0.12 was re-interpreted as 0.12 g — three orders of
   *   magnitude off. Fix: write the per-field unit alongside the
   *   per-field value (and the same for `tempOverrideUnit`,
   *   `bagWidthOverrideUnit`, `bagLengthOverrideUnit`, `volumeUnit`).
   *
   * - B3: the prior payload also dropped `bagGrindId`, `bagPresetId`,
   *   `bagWidthOverride`, `bagLengthOverride`, `bagHasStems`,
   *   `materialMode`, `concentrateTypeId`, `strainId`, the full
   *   `dose` slice (`formatId`, `reverseMode`, `desiredMgPerServing`),
   *   the entire `label` slice, and the entire `advancedTools`
   *   slice. None of these restored on load. Fix: write the full
   *   shape of each slice.
   */
  const buildPresetPayload = useCallback(
    (): PresetPayload =>
      buildPresetPayloadFromState({
        units,
        decarb,
        infusion,
        dose,
        advancedTools,
        label,
      }),
    [units, decarb, infusion, dose, advancedTools, label]
  )

  const handleSaveClick = () => {
    setSaveName('')
    setSaveError(null)
    setShowSaveModal(true)
  }

  const handleSaveConfirm = async () => {
    const name = saveName.trim()
    if (!name) return
    setSaveError(null)
    try {
      const result = await window.App.savePreset({
        name,
        // The IPC contract takes `Record<string, unknown>`;
        // `PresetPayload` is structurally a string-keyed record
        // but its interface doesn't have an explicit index
        // signature. Cast at the IPC boundary — the in-app
        // consumers (tests, loadFromPreset) see the full type.
        presetData: buildPresetPayload() as unknown as Record<string, unknown>,
      })
      if (result.success) {
        setShowSaveModal(false)
        showToast(`Preset saved: ${name}`, 'success')
      } else {
        setSaveError(result.error || 'Could not save')
      }
    } catch {
      setSaveError('Could not save')
    }
  }

  const handleLoadClick = async () => {
    try {
      const result = await window.App.loadPresetDialog()
      if (result.canceled) return
      if (!result.success) {
        showToast(result.error || 'Could not load', 'danger')
        return
      }
      if (result.data) {
        loadFromPreset(result.data)
        const name =
          typeof result.data.name === 'string' ? result.data.name : 'Unnamed'
        showToast(`Preset loaded: ${name}`, 'success')
      }
    } catch {
      showToast('Could not load', 'danger')
    }
  }

  const isSaveDisabled = saveName.trim().length === 0

  return (
    <>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          aria-label="Save preset"
          className="btn-primary"
          onClick={handleSaveClick}
          title="Save preset"
          type="button"
        >
          <Save aria-hidden="true" className="size-3.5" />
          <span className="hidden md:inline">Save Preset</span>
        </button>
        <button
          aria-label="Load preset"
          className="btn-secondary"
          onClick={handleLoadClick}
          title="Load preset"
          type="button"
        >
          <FolderOpen aria-hidden="true" className="size-3.5" />
          <span className="hidden md:inline">Load Preset</span>
        </button>
      </div>

      {showSaveModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-foreground/60 p-3 backdrop-blur-sm"
          role="presentation"
        >
          <div
            aria-labelledby="save-preset-title"
            aria-modal="true"
            ref={saveModalRef}
            role="dialog"
          >
            <GlassCard className="glass-shine w-full max-w-sm rounded-2xl border border-foreground/20 p-5 shadow-2xl sm:p-6">
              <h3
                className="mb-4 text-base font-semibold text-foreground"
                id="save-preset-title"
              >
                Save Preset
              </h3>
              <label
                className="mb-1 block text-sm font-medium text-foreground/80"
                htmlFor="preset-name"
              >
                Preset Name
              </label>
              <input
                aria-describedby={saveError ? 'preset-name-error' : undefined}
                aria-invalid={saveError ? 'true' : undefined}
                className="w-full rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                id="preset-name"
                onChange={e => {
                  setSaveName(e.target.value)
                  setSaveError(null)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !isSaveDisabled) {
                    handleSaveConfirm()
                  }
                  if (e.key === 'Escape') {
                    handleSaveCancel()
                  }
                }}
                placeholder="My Preset"
                ref={saveInputRef}
                type="text"
                value={saveName}
              />
              {saveError && (
                <p
                  className="mt-2 text-xs text-danger"
                  id="preset-name-error"
                  role="alert"
                >
                  {saveError}
                </p>
              )}
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  className="btn-secondary"
                  onClick={handleSaveCancel}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  disabled={isSaveDisabled}
                  onClick={handleSaveConfirm}
                  type="button"
                >
                  Save
                </button>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      <Toast message={toastMsg} variant={toastVariant} visible={toastVisible} />
    </>
  )
}
