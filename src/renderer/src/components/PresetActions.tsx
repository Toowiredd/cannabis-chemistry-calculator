import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import { Save, FolderOpen } from 'lucide-react'
import { Toast, type ToastVariant } from './Toast'

export function PresetActions() {
  const units = useAppStore(s => s.units)
  const decarb = useAppStore(s => s.decarb)
  const infusion = useAppStore(s => s.infusion)
  const dose = useAppStore(s => s.dose)
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

  useEffect(() => {
    if (showSaveModal && saveInputRef.current) {
      saveInputRef.current.focus()
    }
  }, [showSaveModal])

  useEffect(() => {
    if (!showSaveModal) return

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleSaveCancel()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [showSaveModal])

  const buildPresetPayload = useCallback(() => {
    return {
      units: { ...units },
      tabs: {
        decarb: {
          inputs: {
            weight: decarb.weight,
            thcaPct: decarb.thcaPct,
            thcPct: decarb.thcPct,
            cbdaPct: decarb.cbdaPct,
            cbdPct: decarb.cbdPct,
            presetId: decarb.presetId,
            tempOverride: decarb.tempOverride,
            timeOverride: decarb.timeOverride,
            effLowOverride: decarb.effLowOverride,
            effExpectedOverride: decarb.effExpectedOverride,
            effHighOverride: decarb.effHighOverride,
          },
        },
        infusion: {
          inputs: {
            decarbedThc: infusion.decarbedThc,
            volume: infusion.volume,
            fatId: infusion.fatId,
            customEfficiency: infusion.customEfficiency,
          },
        },
        dose: {
          inputs: {
            totalThc: dose.totalThc,
            servings: dose.servings,
          },
        },
      },
    }
  }, [units, decarb, infusion, dose])

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
        presetData: buildPresetPayload(),
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

  const handleSaveCancel = () => {
    setShowSaveModal(false)
    setSaveName('')
    setSaveError(null)
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-foreground/60 p-3 backdrop-blur-sm">
          <div
            aria-labelledby="save-preset-title"
            aria-modal="true"
            className="glass-strong glass-shine w-full max-w-sm rounded-2xl border border-foreground/20 p-5 shadow-2xl sm:p-6"
            role="dialog"
          >
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
          </div>
        </div>
      )}

      <Toast message={toastMsg} variant={toastVariant} visible={toastVisible} />
    </>
  )
}
