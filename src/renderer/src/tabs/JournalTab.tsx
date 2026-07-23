import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import { DECARB_METHODS, INFUSION_FATS } from 'renderer/src/engine/models'
import { calculateTheoreticalMax } from 'renderer/src/engine/decarb'
import { classifyDose, displayDoseLabel } from 'renderer/src/engine/dosing'
import { volumeToMl } from 'renderer/src/engine/units'
import { cn } from 'renderer/lib/utils'
import {
  BookOpen,
  Search,
  Trash2,
  Save,
  RotateCcw,
  ChevronUp,
} from 'lucide-react'
import { TimerWidget } from 'renderer/src/components/Timer'
import { Toast } from 'renderer/src/components/Toast'

function fmt1(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return ''
  return value.toFixed(1)
}

function todayInputValue(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface JournalFormData {
  id: string
  date: string
  strainName: string
  strainId: string | null
  materialWeight: string
  thcaPct: string
  thcPct: string
  cbdaPct: string
  cbdPct: string
  methodId: string
  fatId: string
  servings: string
  mgPerServing: string
  classification: string
  totalInfusedThc: string
  concentration: string
  volume: string
  volumeUnit: string
  notes: string
}

function emptyForm(): JournalFormData {
  return {
    id: '',
    date: todayInputValue(),
    strainName: '',
    strainId: null,
    materialWeight: '',
    thcaPct: '',
    thcPct: '',
    cbdaPct: '',
    cbdPct: '',
    methodId: '',
    fatId: '',
    servings: '',
    mgPerServing: '',
    classification: '',
    totalInfusedThc: '',
    concentration: '',
    volume: '',
    volumeUnit: 'mL',
    notes: '',
  }
}

function buildFormFromStore(
  store: ReturnType<typeof useAppStore.getState>
): JournalFormData {
  const { decarb, infusion, dose, units } = store
  const method = DECARB_METHODS.find(m => m.id === decarb.presetId)
  const fat = INFUSION_FATS.find(f => f.id === infusion.fatId)

  // Compute decarb expected THC for population. All math goes through the
  // engine — the THCA→THC factor, the decarb efficiency, the fat extraction
  // efficiency, the volume unit conversion, and the dose classification all
  // come from engine modules. The hand-coded copies that lived here before
  // were a drift risk flagged by the 2026-07-24 audit (ccc-validation
  // team's first Decarb end-to-end run).
  const weight = parseFloat(decarb.weight)
  const thca = parseFloat(decarb.thcaPct)
  const thc = parseFloat(decarb.thcPct)
  let totalInfused = ''
  let concentration = ''
  let mgPerServing = ''
  let classification = ''

  try {
    // Engine: theoretical max → decarb-adjusted → fat infusion
    const grams = !Number.isNaN(weight) ? weight : 0
    const thcaVal = !Number.isNaN(thca) ? thca : 0
    const thcVal = !Number.isNaN(thc) ? thc : 0
    const eff = method ? method.efficiency.expected : 0.9
    const fatEff = fat?.extractionEff ?? 0.82
    const theoreticalMax = calculateTheoreticalMax(grams, thcaVal, thcVal)
    const decarbed = theoreticalMax * eff
    const infused = decarbed * fatEff
    totalInfused = fmt1(infused)

    // Engine: any-volume-unit → mL
    const vol = parseFloat(infusion.volume)
    if (!Number.isNaN(vol) && vol > 0) {
      const volMl = volumeToMl(vol, units.volumeUnit)
      if (volMl > 0) {
        concentration = fmt1(infused / volMl)
      }
    }

    // Engine: dose classification
    const serv = parseFloat(dose.servings)
    if (!Number.isNaN(serv) && serv > 0) {
      const mps = infused / serv
      mgPerServing = fmt1(mps)
      // classifyDose returns the engine's canonical token (e.g. 'sub-microdose');
      // displayDoseLabel maps it to the Title-Case display the UI surfaces
      // (e.g. 'Sub-Microdose'), matching DoseTab's DOSE_ZONES table.
      classification = displayDoseLabel(classifyDose(mps))
    }
  } catch {
    // Leave downstream fields blank if computation fails (e.g. preset not
    // selected yet, or partial inputs)
  }

  return {
    id: '',
    date: todayInputValue(),
    strainName: '',
    strainId: store.decarb.strainId,
    materialWeight: decarb.weight,
    thcaPct: decarb.thcaPct,
    thcPct: decarb.thcPct,
    cbdaPct: decarb.cbdaPct,
    cbdPct: decarb.cbdPct,
    methodId: decarb.presetId,
    fatId: infusion.fatId,
    servings: dose.servings,
    mgPerServing,
    classification,
    totalInfusedThc: totalInfused,
    concentration,
    volume: infusion.volume,
    volumeUnit: units.volumeUnit,
    notes: '',
  }
}

export function JournalTab() {
  const journalEntries = useAppStore(s => s.journalEntries)
  const setJournalEntries = useAppStore(s => s.setJournalEntries)
  const addJournalEntry = useAppStore(s => s.addJournalEntry)
  const deleteJournalEntry = useAppStore(s => s.deleteJournalEntry)
  const recordSuccessfulPath = useAppStore(s => s.recordSuccessfulPath)
  const store = useAppStore.getState()

  const [form, setForm] = useState<JournalFormData>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [potencyMin, setPotencyMin] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; visible: boolean }>({
    msg: '',
    visible: false,
  })

  const showToast = (msg: string) => {
    setToast({ msg, visible: true })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2000)
  }

  // Load entries on mount
  useEffect(() => {
    // The Electron preload bridge is required for persisted journal storage.
    // Browser-only/dev-renderer audits should degrade instead of route-crashing.
    if (!window.App?.loadJournalEntries) {
      setJournalEntries([])
      return
    }

    window.App.loadJournalEntries().then(result => {
      if (result.success && result.entries) {
        const mapped = result.entries.map((e: Record<string, unknown>) => ({
          id: String(e.id ?? ''),
          date: String(e.date ?? e.savedAt ?? ''),
          strainName: String(e.strainName ?? ''),
          strainId: e.strainId != null ? String(e.strainId) : null,
          materialWeight: String(e.materialWeight ?? ''),
          thcaPct: String(e.thcaPct ?? ''),
          thcPct: String(e.thcPct ?? ''),
          cbdaPct: String(e.cbdaPct ?? ''),
          cbdPct: String(e.cbdPct ?? ''),
          methodId: String(e.methodId ?? ''),
          methodName: String(e.methodName ?? ''),
          fatId: String(e.fatId ?? ''),
          fatName: String(e.fatName ?? ''),
          servings: String(e.servings ?? ''),
          mgPerServing: String(e.mgPerServing ?? ''),
          classification: String(e.classification ?? ''),
          totalInfusedThc: String(e.totalInfusedThc ?? ''),
          concentration: String(e.concentration ?? ''),
          volume: String(e.volume ?? ''),
          volumeUnit: String(e.volumeUnit ?? 'mL'),
          notes: String(e.notes ?? ''),
        }))
        setJournalEntries(mapped)
      }
    })
  }, [setJournalEntries])

  const handleAutoPopulate = () => {
    setForm(buildFormFromStore(store))
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!window.App?.saveJournalEntry) {
      showToast('Journal storage is unavailable in this environment')
      return
    }

    if (!form.strainName.trim()) {
      showToast('Your batch needs a name')
      return
    }

    const method = DECARB_METHODS.find(m => m.id === form.methodId)
    const fat = INFUSION_FATS.find(f => f.id === form.fatId)

    const entry = {
      ...form,
      id:
        form.id ||
        `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      methodName: method?.name ?? '',
      fatName: fat?.name ?? '',
    }

    const result = await window.App.saveJournalEntry(entry)
    if (result.success) {
      addJournalEntry(entry)
      recordSuccessfulPath('history_learn', 'journal')
      setForm(emptyForm())
      setShowForm(false)
      showToast('Entry saved')
    } else {
      showToast(result.error ?? 'Could not save')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.App?.deleteJournalEntry) {
      showToast('Journal storage is unavailable in this environment')
      return
    }

    // Deleting a journal entry removes persisted batch history. Keep the
    // confirmation in-flow so it works in Electron and browser QA without
    // relying on blocking native dialogs.
    const result = await window.App.deleteJournalEntry(id)
    if (result.success) {
      deleteJournalEntry(id)
      setPendingDeleteId(null)
      showToast('Entry deleted')
    } else {
      showToast(result.error ?? 'Could not delete')
    }
  }

  const filtered = useMemo(() => {
    return journalEntries.filter(e => {
      const searchMatch =
        !search.trim() ||
        e.strainName.toLowerCase().includes(search.toLowerCase()) ||
        e.methodName.toLowerCase().includes(search.toLowerCase()) ||
        e.fatName.toLowerCase().includes(search.toLowerCase()) ||
        e.classification.toLowerCase().includes(search.toLowerCase())

      const dateMatch =
        (!dateFrom || e.date >= dateFrom) && (!dateTo || e.date <= dateTo)

      const mps = parseFloat(e.mgPerServing)
      const potencyMatch =
        !potencyMin.trim() ||
        (!Number.isNaN(mps) && mps >= parseFloat(potencyMin))

      return searchMatch && dateMatch && potencyMatch
    })
  }, [journalEntries, search, dateFrom, dateTo, potencyMin])

  const inputRow = (
    label: React.ReactNode,
    children: React.ReactNode,
    extraClass?: string
  ) => (
    <div className={cn('flex flex-col gap-1', extraClass)}>
      <span className="text-xs font-medium text-foreground/80">{label}</span>
      {children}
    </div>
  )

  return (
    <div className="flex min-w-0 flex-col gap-5 p-2 sm:p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="size-5 text-foreground/70" />
          <h2 className="text-xl font-semibold text-foreground">Journal</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            aria-label="Log current calculator values to the journal"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={handleAutoPopulate}
            type="button"
          >
            <Save className="size-3.5" />
            Log to Journal
          </button>
          <button
            aria-label="Create a new journal entry"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={() => {
              setForm(emptyForm())
              setShowForm(true)
            }}
            type="button"
          >
            <BookOpen className="size-3.5" />
            New Entry
          </button>
        </div>
      </div>

      {/* Timer widget */}
      <TimerWidget />

      {/* Entry Form */}
      {showForm && (
        <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
              {form.id ? 'Edit Entry' : 'New Entry'}
            </h3>
            <button
              aria-expanded={showForm}
              className="inline-flex items-center gap-1 rounded-lg border border-foreground/20 bg-foreground/5 px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
              onClick={() => setShowForm(false)}
              type="button"
            >
              <ChevronUp className="size-3" />
              Collapse
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {inputRow(
              'Date',
              <input
                aria-label="Entry date"
                className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                type="date"
                value={form.date}
              />
            )}
            {inputRow(
              'Strain Name',
              <input
                aria-label="Strain name"
                className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e =>
                  setForm(f => ({ ...f, strainName: e.target.value }))
                }
                placeholder="e.g. Blue Dream"
                type="text"
                value={form.strainName}
              />
            )}
            {inputRow(
              'Material Weight (g)',
              <input
                aria-label="Material weight in grams"
                className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e =>
                  setForm(f => ({ ...f, materialWeight: e.target.value }))
                }
                placeholder="0.0"
                step="0.1"
                type="number"
                value={form.materialWeight}
              />
            )}
            {inputRow(
              'THCA %',
              <input
                aria-label="THCA percentage"
                className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e =>
                  setForm(f => ({ ...f, thcaPct: e.target.value }))
                }
                placeholder="0.0"
                step="0.1"
                type="number"
                value={form.thcaPct}
              />
            )}
            {inputRow(
              'Existing THC %',
              <input
                aria-label="Existing THC percentage"
                className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e => setForm(f => ({ ...f, thcPct: e.target.value }))}
                placeholder="0.0"
                step="0.1"
                type="number"
                value={form.thcPct}
              />
            )}
            {inputRow(
              'Method',
              <select
                aria-label="Decarb method"
                className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                onChange={e =>
                  setForm(f => ({ ...f, methodId: e.target.value }))
                }
                value={form.methodId}
              >
                <option className="bg-card text-foreground" value="">
                  Select method
                </option>
                {DECARB_METHODS.map(m => (
                  <option
                    className="bg-card text-foreground"
                    key={m.id}
                    value={m.id}
                  >
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            {inputRow(
              'Fat',
              <select
                aria-label="Infusion fat"
                className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                onChange={e => setForm(f => ({ ...f, fatId: e.target.value }))}
                value={form.fatId}
              >
                <option className="bg-card text-foreground" value="">
                  Select fat
                </option>
                {INFUSION_FATS.map(f => (
                  <option
                    className="bg-card text-foreground"
                    key={f.id}
                    value={f.id}
                  >
                    {f.name}
                  </option>
                ))}
              </select>
            )}
            {inputRow(
              'Servings',
              <input
                aria-label="Servings"
                className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e =>
                  setForm(f => ({ ...f, servings: e.target.value }))
                }
                placeholder="0"
                step="1"
                type="number"
                value={form.servings}
              />
            )}
            {inputRow(
              'mg per Serving',
              <input
                aria-label="Milligrams per serving"
                className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e =>
                  setForm(f => ({ ...f, mgPerServing: e.target.value }))
                }
                placeholder="0.0"
                step="0.1"
                type="number"
                value={form.mgPerServing}
              />
            )}
            {inputRow(
              'Total Infused THC (mg)',
              <input
                aria-label="Total infused THC in milligrams"
                className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e =>
                  setForm(f => ({ ...f, totalInfusedThc: e.target.value }))
                }
                placeholder="0.0"
                step="0.1"
                type="number"
                value={form.totalInfusedThc}
              />
            )}
            {inputRow(
              'Concentration (mg/mL)',
              <input
                aria-label="Concentration in milligrams per milliliter"
                className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e =>
                  setForm(f => ({ ...f, concentration: e.target.value }))
                }
                placeholder="0.0"
                step="0.1"
                type="number"
                value={form.concentration}
              />
            )}
            {inputRow(
              'Volume',
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <input
                  aria-label="Volume amount"
                  className="min-w-[8rem] flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                  onChange={e =>
                    setForm(f => ({ ...f, volume: e.target.value }))
                  }
                  placeholder="0.0"
                  step="0.1"
                  type="number"
                  value={form.volume}
                />
                <select
                  aria-label="Volume unit"
                  className="rounded-lg border border-foreground/20 bg-foreground/5 px-2 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                  onChange={e =>
                    setForm(f => ({ ...f, volumeUnit: e.target.value }))
                  }
                  value={form.volumeUnit}
                >
                  <option className="bg-card text-foreground" value="mL">
                    mL
                  </option>
                  <option className="bg-card text-foreground" value="tsp">
                    tsp
                  </option>
                  <option className="bg-card text-foreground" value="tbsp">
                    tbsp
                  </option>
                  <option className="bg-card text-foreground" value="cup">
                    cup
                  </option>
                </select>
              </div>
            )}
          </div>

          {inputRow(
            'Notes',
            <textarea
              aria-label="Journal notes"
              className="min-h-[80px] w-full rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes about the batch..."
              value={form.notes}
            />
          )}

          <div className="flex flex-col items-stretch justify-end gap-2 sm:flex-row sm:items-center">
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
              onClick={() => setForm(emptyForm())}
              type="button"
            >
              <RotateCcw className="size-3.5" />
              Clear
            </button>
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-success/20 bg-success/10 px-3 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success/20"
              onClick={handleSave}
              type="button"
            >
              <Save className="size-3.5" />
              Save Entry
            </button>
          </div>
        </div>
      )}

      {/* Search / Filter */}
      <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
          Search &amp; Filter
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex min-w-0 items-center gap-2">
            <Search className="size-4 text-foreground/70" />
            <input
              aria-label="Search journal entries"
              className="min-w-0 flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
              onChange={e => setSearch(e.target.value)}
              placeholder="Search strain, method, fat..."
              type="text"
              value={search}
            />
          </div>
          <input
            aria-label="Filter entries from date"
            className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
            onChange={e => setDateFrom(e.target.value)}
            type="date"
            value={dateFrom}
          />
          <input
            aria-label="Filter entries to date"
            className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
            onChange={e => setDateTo(e.target.value)}
            type="date"
            value={dateTo}
          />
          <input
            aria-label="Minimum milligrams per serving"
            className="min-w-0 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
            onChange={e => setPotencyMin(e.target.value)}
            placeholder="Min mg/serving"
            step="0.1"
            type="number"
            value={potencyMin}
          />
        </div>
      </div>

      {/* Entries list */}
      <div className="flex flex-col gap-5">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-foreground/10 bg-foreground/5 p-8 text-center">
            <BookOpen className="size-8 text-foreground/70" />
            <p className="text-sm text-foreground/70">
              No journal entries yet.
            </p>
            <p className="text-xs text-foreground/70">
              Click Log to Journal to auto-populate from your current calculator
              values.
            </p>
          </div>
        )}

        {filtered.map(entry => (
          <div
            className="flex min-w-0 flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 transition-colors sm:p-5"
            key={entry.id}
          >
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="break-words text-lg font-semibold text-foreground">
                  {entry.strainName || 'Unnamed Batch'}
                </span>
                <span className="break-words text-xs text-foreground/70">
                  {entry.date} — {entry.methodName || 'Unknown method'} /{' '}
                  {entry.fatName || 'Unknown fat'}
                </span>
              </div>
              <div className="flex max-w-full flex-wrap items-center gap-2">
                {entry.classification && (
                  <span className="max-w-full break-words rounded-full border border-foreground/10 bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground/70">
                    {entry.classification}
                  </span>
                )}
                {pendingDeleteId === entry.id ? (
                  <div
                    aria-label={`Confirm delete journal entry ${entry.strainName || 'Unnamed Batch'}`}
                    className="flex flex-wrap items-center gap-1 rounded-lg border border-danger/20 bg-danger/10 p-1"
                    role="group"
                  >
                    <span className="px-1 text-xs font-medium text-danger">
                      Delete?
                    </span>
                    <button
                      className="rounded-md border border-foreground/20 bg-foreground/5 px-2 py-1 text-xs text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
                      onClick={() => setPendingDeleteId(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="rounded-md border border-danger/30 bg-danger/20 px-2 py-1 text-xs font-semibold text-danger transition-colors hover:bg-danger/30"
                      onClick={() => handleDelete(entry.id)}
                      type="button"
                    >
                      Confirm
                    </button>
                  </div>
                ) : (
                  <button
                    aria-label={`Delete journal entry ${entry.strainName || 'Unnamed Batch'}`}
                    className="inline-flex items-center rounded-lg border border-danger/20 bg-danger/10 px-2 py-1 text-xs text-danger transition-colors hover:bg-danger/20"
                    onClick={() => setPendingDeleteId(entry.id)}
                    title="Delete entry"
                    type="button"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-foreground/70">
                  Weight
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {entry.materialWeight} g
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-foreground/70">
                  THCA / THC
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {entry.thcaPct}% / {entry.thcPct}%
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-foreground/70">
                  mg/Serving
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {entry.mgPerServing} mg
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-foreground/70">
                  Total THC
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {entry.totalInfusedThc} mg
                </span>
              </div>
            </div>

            {(entry.concentration || entry.volume || entry.notes) && (
              <div className="flex flex-col gap-1 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
                {entry.concentration && (
                  <span className="text-xs text-foreground/70">
                    Concentration: {entry.concentration} mg/mL in {entry.volume}{' '}
                    {entry.volumeUnit}
                  </span>
                )}
                {entry.notes && (
                  <p className="text-xs text-foreground/70">{entry.notes}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Toast message={toast.msg} visible={toast.visible} />

      {/* Disclaimer */}
      <p className="text-center text-xs leading-relaxed text-foreground/70">
        Estimates are heuristic approximations, not laboratory results. Actual
        potency varies with material quality, technique, and measurement
        accuracy.
      </p>
    </div>
  )
}
