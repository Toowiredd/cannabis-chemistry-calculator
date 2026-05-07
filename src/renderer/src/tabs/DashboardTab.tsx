import { useMemo, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import { cn } from 'renderer/lib/utils'
import {
  calculateTheoreticalMax,
  calculateDecarbedThc,
} from 'renderer/src/engine/decarb'
import { calculateInfusedThc } from 'renderer/src/engine/infusion'
import {
  calculateCostPerMg,
  calculateCostPerDose,
} from 'renderer/src/engine/costAnalysis'
import {
  LayoutDashboard,
  BarChart3,
  PieChart,
  TrendingUp,
  Package,
  AlertTriangle,
  Plus,
  Trash2,
  ShoppingCart,
  Scissors,
} from 'lucide-react'
import { Toast } from 'renderer/src/components/Toast'

function fmt1(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '0.0'
  return value.toFixed(1)
}

function monthKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function currentMonthKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

interface InventoryForm {
  type: 'purchase' | 'usage'
  name: string
  amountGrams: string
  cost: string
  notes: string
}

function emptyInventoryForm(): InventoryForm {
  return { type: 'purchase', name: '', amountGrams: '', cost: '', notes: '' }
}

/* ─── SVG Charts ─── */

function BarChartSVG({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.value))
  const barWidth = data.length > 0 ? Math.max(10, 320 / data.length) : 0
  const gap = 4
  const maxVisible = Math.min(data.length, 12)
  const visible = data.slice(-maxVisible)
  const chartHeight = 140

  return (
    <svg
      aria-label="Bar chart of monthly usage amounts"
      className="w-full h-40"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      viewBox={`0 0 ${visible.length * (barWidth + gap)} ${chartHeight + 20}`}
    >
      {visible.map((d, i) => {
        const h = (d.value / max) * chartHeight
        const x = i * (barWidth + gap)
        const y = chartHeight - h
        return (
          <g key={d.label}>
            <rect
              className="fill-emerald-400/70"
              height={h}
              rx={3}
              width={barWidth}
              x={x}
              y={y}
            />
            <text
              className="fill-foreground/70 text-[10px]"
              textAnchor="middle"
              x={x + barWidth / 2}
              y={chartHeight + 15}
            >
              {d.label.slice(-2)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function PieChartSVG({
  data,
}: {
  data: { label: string; value: number; color: string }[]
}) {
  const total = Math.max(
    1,
    data.reduce((s, d) => s + d.value, 0)
  )
  const r = 50
  const cx = 70
  const cy = 60
  let angle = 0

  return (
    <svg
      aria-label="Pie chart of potency by category"
      className="w-full h-40"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      viewBox="0 0 200 120"
    >
      <g transform={`translate(${cx},${cy})`}>
        {data.map(d => {
          const slice = (d.value / total) * Math.PI * 2
          const x1 = Math.cos(angle) * r
          const y1 = Math.sin(angle) * r
          const x2 = Math.cos(angle + slice) * r
          const y2 = Math.sin(angle + slice) * r
          const largeArc = slice > Math.PI ? 1 : 0
          const path = `M 0 0 L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
          const el = (
            <path
              d={path}
              fill={d.color}
              key={d.label}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
          )
          angle += slice
          return el
        })}
      </g>
      {data.map((d, i) => (
        <g key={`legend-${d.label}`}>
          <rect
            fill={d.color}
            height={8}
            rx={2}
            width={8}
            x={140}
            y={16 + i * 18}
          />
          <text
            className="fill-foreground/70 text-[10px]"
            x={152}
            y={24 + i * 18}
          >
            {d.label} {Math.round((d.value / total) * 100)}%
          </text>
        </g>
      ))}
    </svg>
  )
}

function SparklineSVG({ values }: { values: number[] }) {
  if (values.length === 0)
    return (
      <div className="h-40 flex items-center justify-center text-xs text-foreground/70">
        No data
      </div>
    )
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)
  const pad = 4
  const w = 340
  const h = 120
  const step = w / Math.max(values.length - 1, 1)

  const points = values.map((v, i) => {
    const x = i * step
    const y = h - ((v - min) / range) * (h - pad * 2) - pad
    return `${x},${y}`
  })

  const _path = `M ${points.join(' L ')}`

  return (
    <svg
      aria-label="Sparkline chart of potency values over time"
      className="w-full h-40"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      viewBox={`0 0 ${w} ${h}`}
    >
      <polyline
        fill="none"
        points={points.join(' ')}
        stroke="#34d399"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <circle
        cx={points[points.length - 1].split(',')[0]}
        cy={points[points.length - 1].split(',')[1]}
        fill="#34d399"
        r={3}
      />
    </svg>
  )
}

export function DashboardTab() {
  const journalEntries = useAppStore(s => s.journalEntries)
  const inventory = useAppStore(s => s.inventory)
  const setInventory = useAppStore(s => s.setInventory)
  const addInventoryItem = useAppStore(s => s.addInventoryItem)
  const deleteInventoryItem = useAppStore(s => s.deleteInventoryItem)

  const [form, setForm] = useState<InventoryForm>(emptyInventoryForm())
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState<{ msg: string; visible: boolean }>({
    msg: '',
    visible: false,
  })
  const showToast = (msg: string) => {
    setToast({ msg, visible: true })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2000)
  }

  const currentMonth = currentMonthKey()

  const stats = useMemo(() => {
    const monthEntries = journalEntries.filter(
      e => monthKey(e.date) === currentMonth
    )
    const totalBatches = journalEntries.length
    const monthBatches = monthEntries.length
    const avgPotency =
      monthEntries.length > 0
        ? monthEntries.reduce(
            (sum, e) => sum + (parseFloat(e.mgPerServing) || 0),
            0
          ) / monthEntries.length
        : 0

    // Most used method
    const methodCounts: Record<string, number> = {}
    journalEntries.forEach(e => {
      if (e.methodName)
        methodCounts[e.methodName] = (methodCounts[e.methodName] || 0) + 1
    })
    const mostUsedMethod =
      Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-'

    // Most used fat
    const fatCounts: Record<string, number> = {}
    journalEntries.forEach(e => {
      if (e.fatName) fatCounts[e.fatName] = (fatCounts[e.fatName] || 0) + 1
    })
    const mostUsedFat =
      Object.entries(fatCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-'

    // Total THC produced
    const totalThc = journalEntries.reduce(
      (sum, e) => sum + (parseFloat(e.totalInfusedThc) || 0),
      0
    )

    // Cost summary: use inventory cost if available
    const totalCost = inventory.items.reduce(
      (sum, i) => sum + (i.type === 'purchase' ? parseFloat(i.cost || '0') : 0),
      0
    )

    // Cost analysis using costAnalysis engine
    let costPerMg = 0
    let costPerBatch = 0
    if (totalThc > 0 && totalCost > 0) {
      try {
        costPerMg = calculateCostPerMg(totalCost, totalThc)
      } catch {
        /* ignore */
      }
    }
    if (totalBatches > 0 && totalCost > 0) {
      try {
        costPerBatch = calculateCostPerDose(totalCost, totalBatches)
      } catch {
        /* ignore */
      }
    }

    return {
      totalBatches,
      monthBatches,
      avgPotency,
      mostUsedMethod,
      mostUsedFat,
      totalThc,
      totalCost,
      costPerMg,
      costPerBatch,
    }
  }, [journalEntries, inventory.items, currentMonth])

  // Bar chart data: batches per month (last 12 months)
  const barChartData = useMemo(() => {
    const map: Record<string, number> = {}
    journalEntries.forEach(e => {
      const k = monthKey(e.date)
      if (k) map[k] = (map[k] || 0) + 1
    })
    const keys = Object.keys(map).sort()
    return keys.map(k => ({ label: k, value: map[k] }))
  }, [journalEntries])

  // Pie chart data: methods used
  const pieChartData = useMemo(() => {
    const map: Record<string, number> = {}
    journalEntries.forEach(e => {
      if (e.methodName) map[e.methodName] = (map[e.methodName] || 0) + 1
    })
    const colors = [
      '#34d399',
      '#60a5fa',
      '#fbbf24',
      '#f87171',
      '#a78bfa',
      '#22d3ee',
    ]
    return Object.entries(map).map(([label, value], i) => ({
      label,
      value,
      color: colors[i % colors.length],
    }))
  }, [journalEntries])

  // Sparkline data: potency trend over entries (oldest to newest)
  const potencyTrend = useMemo(() => {
    const sorted = [...journalEntries].sort((a, b) =>
      a.date.localeCompare(b.date)
    )
    return sorted.map(e => parseFloat(e.mgPerServing) || 0)
  }, [journalEntries])

  // Inventory calculations
  const inventoryTotals = useMemo(() => {
    const onHand = inventory.items.reduce((sum, i) => {
      const g = parseFloat(i.amountGrams) || 0
      return i.type === 'purchase' ? sum + g : sum - g
    }, 0)

    const materialUsedMonth = inventory.items
      .filter(i => i.type === 'usage' && monthKey(i.date) === currentMonth)
      .reduce((sum, i) => sum + (parseFloat(i.amountGrams) || 0), 0)

    const theoreticalMax = calculateTheoreticalMax(onHand, 20, 0)
    const decarbedThc = calculateDecarbedThc(theoreticalMax, 0.85)
    const estimatedThcMg = calculateInfusedThc(decarbedThc, 0.82)

    const threshold = parseFloat(inventory.lowStockThreshold) || 3.5
    const lowStock = onHand < threshold

    return { onHand, materialUsedMonth, estimatedThcMg, lowStock, threshold }
  }, [inventory.items, inventory.lowStockThreshold, currentMonth])

  const handleAddItem = () => {
    if (
      !form.name.trim() ||
      !form.amountGrams.trim() ||
      parseFloat(form.amountGrams) <= 0
    ) {
      showToast('Please enter a name and a positive amount')
      return
    }
    const item = {
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString().slice(0, 10),
      type: form.type,
      name: form.name.trim(),
      amountGrams: form.amountGrams.trim(),
      cost: form.cost.trim() || undefined,
      notes: form.notes.trim() || undefined,
    }
    addInventoryItem(item)
    setForm(emptyInventoryForm())
    setShowForm(false)
    showToast(`${form.type === 'purchase' ? 'Purchase' : 'Usage'} logged`)
  }

  const StatCard = ({
    label,
    value,
    icon,
    accentClass,
  }: {
    label: string
    value: string
    icon: React.ReactNode
    accentClass?: string
  }) => (
    <div className="glass-strong flex flex-col gap-2 rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg',
            accentClass || 'bg-foreground/5'
          )}
        >
          {icon}
        </span>
        <span className="text-xs font-medium uppercase tracking-wider text-foreground/70">
          {label}
        </span>
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-4 p-2">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="size-5 text-foreground/70" />
          <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>
        </div>
      </div>

      {/* Low-stock alert */}
      {inventoryTotals.lowStock && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
          <AlertTriangle className="size-5 shrink-0 text-amber-400" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-amber-300">
              Low Stock Alert
            </span>
            <span className="text-xs text-amber-300/70">
              Material on hand ({fmt1(inventoryTotals.onHand)} g) is below the
              threshold of {fmt1(inventoryTotals.threshold)} g.
            </span>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          accentClass="bg-emerald-400/10"
          icon={<BarChart3 className="size-4 text-emerald-400" />}
          label="Total Batches"
          value={String(stats.totalBatches)}
        />
        <StatCard
          accentClass="bg-emerald-400/10"
          icon={<TrendingUp className="size-4 text-emerald-400" />}
          label="This Month"
          value={String(stats.monthBatches)}
        />
        <StatCard
          accentClass="bg-sky-400/10"
          icon={<TrendingUp className="size-4 text-sky-400" />}
          label="Avg Potency"
          value={`${fmt1(stats.avgPotency)} mg/serving`}
        />
        <StatCard
          accentClass="bg-violet-400/10"
          icon={<Package className="size-4 text-violet-400" />}
          label="Total THC"
          value={`${fmt1(stats.totalThc)} mg`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          accentClass="bg-amber-400/10"
          icon={<BarChart3 className="size-4 text-amber-400" />}
          label="Most Used Method"
          value={stats.mostUsedMethod || '-'}
        />
        <StatCard
          accentClass="bg-fuchsia-400/10"
          icon={<Package className="size-4 text-fuchsia-400" />}
          label="Most Used Fat"
          value={stats.mostUsedFat || '-'}
        />
        <StatCard
          accentClass="bg-rose-400/10"
          icon={<ShoppingCart className="size-4 text-rose-400" />}
          label="Total Cost"
          value={`$${fmt1(stats.totalCost)}`}
        />
        <StatCard
          accentClass="bg-amber-400/10"
          icon={<TrendingUp className="size-4 text-amber-400" />}
          label="Cost per mg"
          value={
            stats.totalThc > 0 && stats.totalCost > 0
              ? `$${stats.costPerMg.toFixed(3)}`
              : 'N/A'
          }
        />
        <StatCard
          accentClass="bg-fuchsia-400/10"
          icon={<TrendingUp className="size-4 text-fuchsia-400" />}
          label="Cost per Batch"
          value={
            stats.totalBatches > 0 && stats.totalCost > 0
              ? `$${stats.costPerBatch.toFixed(2)}`
              : 'N/A'
          }
        />
        <StatCard
          accentClass="bg-emerald-400/10"
          icon={<Package className="size-4 text-emerald-400" />}
          label="Material on Hand"
          value={`${fmt1(inventoryTotals.onHand)} g`}
        />
        <StatCard
          accentClass="bg-violet-400/10"
          icon={<Package className="size-4 text-violet-400" />}
          label="Est. THC Remaining"
          value={`${fmt1(inventoryTotals.estimatedThcMg)} mg`}
        />
        <StatCard
          accentClass="bg-rose-400/10"
          icon={<Scissors className="size-4 text-rose-400" />}
          label="Used This Month"
          value={`${fmt1(inventoryTotals.materialUsedMonth)} g`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass-strong flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-foreground/70" />
            <h3 className="text-sm font-semibold text-foreground/70">
              Batches per Month
            </h3>
          </div>
          {barChartData.length > 0 ? (
            <BarChartSVG data={barChartData} />
          ) : (
            <div className="flex h-40 items-center justify-center text-xs text-foreground/70">
              No journal entries yet
            </div>
          )}
        </div>

        <div className="glass-strong flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <PieChart className="size-4 text-foreground/70" />
            <h3 className="text-sm font-semibold text-foreground/70">
              Methods Used
            </h3>
          </div>
          {pieChartData.length > 0 ? (
            <PieChartSVG data={pieChartData} />
          ) : (
            <div className="flex h-40 items-center justify-center text-xs text-foreground/70">
              No journal entries yet
            </div>
          )}
        </div>

        <div className="glass-strong flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-foreground/70" />
            <h3 className="text-sm font-semibold text-foreground/70">
              Potency Trend
            </h3>
          </div>
          {potencyTrend.length > 1 ? (
            <SparklineSVG values={potencyTrend} />
          ) : (
            <div className="flex h-40 items-center justify-center text-xs text-foreground/70">
              Need at least 2 entries
            </div>
          )}
        </div>
      </div>

      {/* Inventory section */}
      <div className="glass-strong flex flex-col gap-4 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            Inventory
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground/70">
              Low-stock threshold (g)
            </span>
            <input
              className="w-20 rounded-lg border border-foreground/20 bg-foreground/5 px-2 py-1 text-right text-sm text-foreground outline-none focus:border-foreground/40"
              onChange={e =>
                setInventory({ lowStockThreshold: e.target.value })
              }
              step="0.1"
              type="number"
              value={inventory.lowStockThreshold}
            />
            <button
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-400/20"
              onClick={() => {
                setForm(emptyInventoryForm())
                setShowForm(true)
              }}
              type="button"
            >
              <Plus className="size-3.5" />
              Log
            </button>
          </div>
        </div>

        {showForm && (
          <div className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-foreground/5 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground/70">
                  Type
                </span>
                <select
                  className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40"
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      type: e.target.value as 'purchase' | 'usage',
                    }))
                  }
                  value={form.type}
                >
                  <option className="bg-card text-foreground" value="purchase">
                    Purchase
                  </option>
                  <option className="bg-card text-foreground" value="usage">
                    Usage
                  </option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground/70">
                  Name
                </span>
                <input
                  className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground/30 focus:border-foreground/40"
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Strain or product"
                  type="text"
                  value={form.name}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground/70">
                  Amount (g)
                </span>
                <input
                  className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground/30 focus:border-foreground/40"
                  onChange={e =>
                    setForm(f => ({ ...f, amountGrams: e.target.value }))
                  }
                  placeholder="0.0"
                  step="0.1"
                  type="number"
                  value={form.amountGrams}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground/70">
                  Cost ($)
                </span>
                <input
                  className="rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground/30 focus:border-foreground/40"
                  onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={form.cost}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground/70">
                Notes
              </span>
              <input
                className="w-full rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground/30 focus:border-foreground/40"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes..."
                type="text"
                value={form.notes}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                className="inline-flex items-center gap-1 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
                onClick={() => setShowForm(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-400/20"
                onClick={handleAddItem}
                type="button"
              >
                <Plus className="size-3.5" />
                Add Entry
              </button>
            </div>
          </div>
        )}

        {/* Inventory list */}
        <div className="flex flex-col gap-2">
          {inventory.items.length === 0 && (
            <div className="text-center text-xs text-foreground/70 py-4">
              No inventory logged yet.
            </div>
          )}
          {inventory.items.map(item => (
            <div
              className="flex items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3 transition-colors"
              key={item.id}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold',
                    item.type === 'purchase'
                      ? 'bg-emerald-400/15 text-emerald-400'
                      : 'bg-rose-400/15 text-rose-400'
                  )}
                >
                  {item.type === 'purchase' ? 'IN' : 'OUT'}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-foreground/70">
                    {item.date}{' '}
                    {item.cost ? `· $${parseFloat(item.cost).toFixed(2)}` : ''}{' '}
                    {item.notes ? `· ${item.notes}` : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">
                  {parseFloat(item.amountGrams).toFixed(1)} g
                </span>
                <button
                  className="inline-flex items-center rounded-lg border border-red-400/20 bg-red-400/10 px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-400/20"
                  onClick={() => {
                    deleteInventoryItem(item.id)
                    showToast('Item removed')
                  }}
                  title="Delete"
                  type="button"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs leading-relaxed text-foreground/70">
        Estimates are heuristic approximations, not laboratory results. Actual
        potency varies with material quality, technique, and measurement
        accuracy.
      </p>

      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  )
}
