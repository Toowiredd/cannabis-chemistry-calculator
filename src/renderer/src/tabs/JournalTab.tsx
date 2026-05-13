import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import { DECARB_METHODS, INFUSION_FATS } from 'renderer/src/engine/models'
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

  // Compute decarb expected THC for population
  const weight = parseFloat(decarb.weight)
  const thca = parseFloat(decarb.thcaPct)
  const thc = parseFloat(decarb.thcPct)
  let totalInfused = ''
  let concentration = ''
  let mgPerServing = ''
  let classification = ''

  try {
    // Reuse engine-like simple math to fill downstream values
    const grams = !Number.isNaN(weight) ? weight : 0
    const thcaVal = !Number.isNaN(thca) ? thca : 0
    const thcVal = !Number.isNaN(thc) ? thc : 0
    const eff = method ? method.efficiency.expected : 0.9
    const theoreticalMax =
      grams * ((thcaVal / 100) * 0.877 + thcVal / 100) * 1000
    const decarbed = theoreticalMax * eff

    const fatEff = fat?.extractionEff ?? 0.82
    const infused = decarbed * fatEff
    totalInfused = fmt1(infused)

    const vol = parseFloat(infusion.volume)
    const volMl =
      units.volumeUnit === 'mL'
        ? vol
        : units.volumeUnit === 'tsp'
          ? vol * 4.929
          : units.volumeUnit === 'tbsp'
            ? vol * 14.787
            : vol * 236.588
    if (!Number.isNaN(volMl) && volMl > 0) {
      concentration = fmt1(infused / volMl)
    }

    const serv = parseFloat(dose.servings)
    if (!Number.isNaN(serv) && serv > 0) {
      mgPerServing = fmt1(infused / serv)
      const mps = infused / serv
      if (mps < 2.5) classification = 'Sub-Microdose'
      else if (mps < 5) classification = 'Microdose'
      else if (mps < 10) classification = 'Low'
      else if (mps < 25) classification = 'Moderate'
      else if (mps < 50) classification = 'Strong'
      else if (mps < 100) classification = 'Very Strong'
      else classification = 'Extreme'
    }
  } catch {
    // Leave downstream fields blank if computation fails
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
  const store = useAppStore.getState()

  const [form, setForm] = useState<JournalFormData>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [potencyMin, setPotencyMin] = useState('')
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
      setForm(emptyForm())
      setShowForm(false)
      showToast('Entry saved')
    } else {
      showToast(result.error ?? 'Could not save')
    }
  }

  const handleDelete = async (id: string) => {
    const result = await window.App.deleteJournalEntry(id)
    if (result.success) {
      deleteJournalEntry(id)
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
    <div className="flex flex-col gap-5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-foreground/70" />
          <h2 className="text-xl font-semibold text-foreground">Journal</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={handleAutoPopulate}
            type="button"
          >
            <Save className="size-3.5" />
            Log to Journal
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
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
        <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/5 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
              {form.id ? 'Edit Entry' : 'New Entry'}
            </h3>
            <button
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
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                type="date"
                value={form.date}
              />
            )}
            {inputRow(
              'Strain Name',
              <input
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
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
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
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
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
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
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
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
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
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
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
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
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
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
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
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
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
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
                className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
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
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                  onChange={e =>
                    setForm(f => ({ ...f, volume: e.target.value }))
                  }
                  placeholder="0.0"
                  step="0.1"
                  type="number"
                  value={form.volume}
                />
                <select
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
              className="min-h-[80px] w-full rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes about the batch..."
              value={form.notes}
            />
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
              onClick={() => setForm(emptyForm())}
              type="button"
            >
              <RotateCcw className="size-3.5" />
              Clear
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-success/20 bg-success/10 px-3 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success/20"
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
      <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/5 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
          Search &amp; Filter
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2">
            <Search className="size-4 text-foreground/70" />
            <input
              className="flex-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
              onChange={e => setSearch(e.target.value)}
              placeholder="Search strain, method, fat..."
              type="text"
              value={search}
            />
          </div>
          <input
            className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
            onChange={e => setDateFrom(e.target.value)}
            type="date"
            value={dateFrom}
          />
          <input
            className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
            onChange={e => setDateTo(e.target.value)}
            type="date"
            value={dateTo}
          />
          <input
            className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
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
            className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/5 p-5 transition-colors"
            key={entry.id}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-lg font-semibold text-foreground">
                  {entry.strainName || 'Unnamed Batch'}
                </span>
                <span className="text-xs text-foreground/70">
                  {entry.date} — {entry.methodName || 'Unknown method'} /{' '}
                  {entry.fatName || 'Unknown fat'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {entry.classification && (
                  <span className="rounded-full border border-foreground/10 bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground/70">
                    {entry.classification}
                  </span>
                )}
                <button
                  className="inline-flex items-center rounded-lg border border-danger/20 bg-danger/10 px-2 py-1 text-xs text-danger transition-colors hover:bg-danger/20"
                  onClick={() => handleDelete(entry.id)}
                  title="Delete entry"
                  type="button"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
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
