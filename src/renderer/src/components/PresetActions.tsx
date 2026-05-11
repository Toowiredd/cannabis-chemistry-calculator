import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import { Save, FolderOpen } from 'lucide-react'
import { Toast } from './Toast'

export function PresetActions() {
  /* Fine-grained Zustand selectors to avoid unnecessary re-renders */
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
  const saveInputRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2000)
  }, [])

  /* Auto-focus input when save modal opens */
  useEffect(() => {
    if (showSaveModal && saveInputRef.current) {
      saveInputRef.current.focus()
    }
  }, [showSaveModal])

  const buildPresetPayload = useCallback((): Record<string, unknown> => {
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
        showToast(`Preset saved: ${name}`)
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
        showToast(result.error || 'Could not load')
        return
      }

      if (result.data) {
        loadFromPreset(result.data)
        const name =
          typeof result.data.name === 'string' ? result.data.name : 'Unnamed'
        showToast(`Preset loaded: ${name}`)
      }
    } catch {
      showToast('Could not load')
    }
  }

  const isSaveDisabled = saveName.trim().length === 0

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          onClick={handleSaveClick}
          type="button"
        >
          <Save className="size-3.5" />
          Save Preset
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          onClick={handleLoadClick}
          type="button"
        >
          <FolderOpen className="size-3.5" />
          Load Preset
        </button>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-foreground/60 backdrop-blur-sm">
          <div className="glass-strong w-full max-w-sm rounded-2xl border border-foreground/20 p-6 shadow-2xl">
            <h3 className="mb-4 text-base font-semibold text-foreground">
              Save Preset
            </h3>

            <label
              className="mb-1 block text-sm font-medium text-foreground/80"
              htmlFor="preset-name"
            >
              Preset Name
            </label>
            <input
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
              <p className="mt-2 text-xs text-danger">{saveError}</p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-4 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
                onClick={handleSaveCancel}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-foreground/15 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-foreground/25 disabled:cursor-not-allowed disabled:opacity-40"
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

      <Toast message={toastMsg} visible={toastVisible} />
    </>
  )
}
