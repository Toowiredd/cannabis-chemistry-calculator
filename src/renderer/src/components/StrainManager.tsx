import { useState, useCallback, useEffect, useMemo } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import type { Strain } from 'renderer/src/engine/models'
import { globalStrainLibrary } from 'renderer/src/engine/strainLib'
import { Leaf, Save, X, Pencil, Trash2 } from 'lucide-react'
import { useModalA11y } from '../hooks/useModalA11y'

interface StrainFormData {
  name: string
  type: 'indica' | 'sativa' | 'hybrid'
  thcaPct: string
  thcPct: string
  cbdaPct: string
  cbdPct: string
  notes: string
}

const EMPTY_FORM: StrainFormData = {
  name: '',
  type: 'hybrid',
  thcaPct: '',
  thcPct: '',
  cbdaPct: '',
  cbdPct: '',
  notes: '',
}

function clampTo100(value: string): string {
  const n = parseFloat(value)
  if (Number.isNaN(n)) return value
  if (n < 0) return '0'
  if (n > 100) return '100'
  return value
}

export function StrainManager({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect?: (strain: Strain) => void
}) {
  const strains = useAppStore(s => s.strains)
  const setStrains = useAppStore(s => s.setStrains)
  const journalEntries = useAppStore(s => s.journalEntries)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<StrainFormData>(EMPTY_FORM)
  const [error, setError] = useState('')

  /* Load strains from disk on open */
  useEffect(() => {
    if (!open) return
    async function load() {
      try {
        const res = await window.App.loadStrains()
        if (res.success && Array.isArray(res.strains)) {
          setStrains(res.strains)
        }
      } catch {
        // silent fail
      }
    }
    load()
  }, [open, setStrains])

  /* Persist strains whenever they change */
  useEffect(() => {
    if (!open) return
    async function save() {
      try {
        await window.App.saveStrains(strains)
      } catch {
        // silent fail
      }
    }
    save()
  }, [strains, open])

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setError('')
  }, [])

  const validateForm = useCallback((): string | null => {
    if (!form.name.trim()) return 'Your strain needs a name'
    const thca = parseFloat(form.thcaPct)
    const thc = parseFloat(form.thcPct)
    if (!Number.isNaN(thca) && !Number.isNaN(thc) && thca + thc > 100) {
      return 'THCA plus THC cannot go past 100%'
    }
    const cbda = parseFloat(form.cbdaPct)
    const cbd = parseFloat(form.cbdPct)
    if (!Number.isNaN(cbda) && !Number.isNaN(cbd) && cbda + cbd > 100) {
      return 'CBDA plus CBD cannot go past 100%'
    }
    return null
  }, [form])

  const handleSave = useCallback(() => {
    const err = validateForm()
    if (err) {
      setError(err)
      return
    }

    try {
      const data = {
        name: form.name.trim(),
        type: form.type,
        thcaPct: parseFloat(form.thcaPct) || 0,
        thcPct: parseFloat(form.thcPct) || 0,
        cbdaPct: parseFloat(form.cbdaPct) || 0,
        cbdPct: parseFloat(form.cbdPct) || 0,
        notes: form.notes.trim(),
      }

      if (editingId) {
        globalStrainLibrary.update(editingId, data)
      } else {
        globalStrainLibrary.add(data)
      }

      // Sync engine state back to Zustand for UI reactivity
      setStrains(globalStrainLibrary.list())
    } catch (catchErr: unknown) {
      const msg =
        catchErr instanceof Error ? catchErr.message : 'Failed to save strain'
      setError(msg)
      return
    }

    resetForm()
  }, [form, editingId, validateForm, resetForm, setStrains])

  const handleEdit = useCallback((strain: Strain) => {
    setForm({
      name: strain.name,
      type: strain.type,
      thcaPct: String(strain.thcaPct),
      thcPct: String(strain.thcPct),
      cbdaPct: String(strain.cbdaPct),
      cbdPct: String(strain.cbdPct),
      notes: strain.notes ?? '',
    })
    setEditingId(strain.id)
    setError('')
  }, [])

  const handleDelete = useCallback(
    (id: string) => {
      globalStrainLibrary.delete(id)
      setStrains(globalStrainLibrary.list())
      if (editingId === id) resetForm()
    },
    [editingId, resetForm, setStrains]
  )

  const handleSelect = useCallback(
    (strain: Strain) => {
      onSelect?.(strain)
      onClose()
    },
    [onSelect, onClose]
  )

  // Compute per-strain usage stats from journal entries
  const strainUsage = useMemo(() => {
    const map: Record<
      string,
      { count: number; lastUsed: string; totalGrams: number }
    > = {}
    journalEntries.forEach(entry => {
      if (!entry.strainId) return
      const existing = map[entry.strainId] ?? {
        count: 0,
        lastUsed: '',
        totalGrams: 0,
      }
      existing.count += 1
      if (entry.date > existing.lastUsed) existing.lastUsed = entry.date
      existing.totalGrams += parseFloat(entry.materialWeight) || 0
      map[entry.strainId] = existing
    })
    return map
  }, [journalEntries])

  if (!open) return null

  const sortedStrains = [...strains].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  const modalRef = useModalA11y(open, onClose)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation">
      <div
        aria-labelledby="strain-manager-title"
        aria-modal="true"
        className="glass-strong flex w-full max-w-lg flex-col rounded-2xl shadow-2xl"
        ref={modalRef}
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Leaf className="size-5 text-success" />
            <h2 className="text-lg font-semibold text-foreground" id="strain-manager-title">
              Strain Library
            </h2>
          </div>
          <button
            className="rounded-lg p-1 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-3 px-5 py-4">
          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground/70">
                Name
              </span>
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Blue Dream"
                value={form.name}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground/70">
                Type
              </span>
              <select
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                onChange={e =>
                  setForm({ ...form, type: e.target.value as Strain['type'] })
                }
                value={form.type}
              >
                <option value="sativa">Sativa</option>
                <option value="indica">Indica</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground/70">
                THCA %
              </span>
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                max={100}
                min={0}
                onChange={e =>
                  setForm({ ...form, thcaPct: clampTo100(e.target.value) })
                }
                placeholder="0.0"
                step="0.1"
                type="number"
                value={form.thcaPct}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground/70">
                THC %
              </span>
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                max={100}
                min={0}
                onChange={e =>
                  setForm({ ...form, thcPct: clampTo100(e.target.value) })
                }
                placeholder="0.0"
                step="0.1"
                type="number"
                value={form.thcPct}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground/70">
                CBDA %
              </span>
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                max={100}
                min={0}
                onChange={e =>
                  setForm({ ...form, cbdaPct: clampTo100(e.target.value) })
                }
                placeholder="0.0"
                step="0.1"
                type="number"
                value={form.cbdaPct}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground/70">
                CBD %
              </span>
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                max={100}
                min={0}
                onChange={e =>
                  setForm({ ...form, cbdPct: clampTo100(e.target.value) })
                }
                placeholder="0.0"
                step="0.1"
                type="number"
                value={form.cbdPct}
              />
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground/70">
                Notes
              </span>
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes..."
                value={form.notes}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-success"
              onClick={handleSave}
              type="button"
            >
              <Save className="size-4" />
              {editingId ? 'Update Strain' : 'Save Strain'}
            </button>
            {editingId && (
              <button
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10"
                onClick={resetForm}
                type="button"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="max-h-64 flex-1 overflow-y-auto border-t border-foreground/10 px-5 py-3">
          {sortedStrains.length === 0 ? (
            <p className="text-center text-sm text-foreground/70">
              No strains saved yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {sortedStrains.map(strain => {
                const usage = strainUsage[strain.id]
                return (
                  <div
                    className="flex items-center justify-between rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2 transition-colors hover:bg-foreground/10"
                    key={strain.id}
                  >
                    <button
                      className="flex flex-1 flex-col items-start gap-0.5 text-left"
                      onClick={() => handleSelect(strain)}
                      type="button"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {strain.name}
                      </span>
                      <span className="text-xs text-foreground/70">
                        {strain.type} · THCA {strain.thcaPct}% · THC{' '}
                        {strain.thcPct}%
                        {strain.cbdaPct > 0 && ` · CBDA ${strain.cbdaPct}%`}
                        {strain.cbdPct > 0 && ` · CBD ${strain.cbdPct}%`}
                        {usage && (
                          <>
                            {' '}
                            · Used in {usage.count} batch
                            {usage.count !== 1 ? 'es' : ''}
                            {usage.lastUsed && ` · Last: ${usage.lastUsed}`}
                          </>
                        )}
                      </span>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded p-1 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                        onClick={() => handleEdit(strain)}
                        type="button"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        className="rounded p-1 text-foreground/70 transition-colors hover:bg-danger/10 hover:text-danger"
                        onClick={() => handleDelete(strain.id)}
                        type="button"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
