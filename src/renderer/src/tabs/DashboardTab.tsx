import { useEffect, useMemo, useRef, useState } from 'react'
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
import { InventorySection } from 'renderer/src/components/InventorySection'
import { StockRecipeCard } from 'renderer/src/components/StockRecipeCard'
// 2026-07-26 wizard Week 6 (§8.3): the design-system agent owns
// the `StockRecipeCard` component (in
// `src/renderer/src/components/StockRecipeCard.tsx`) and the
// `StockRecipe` interface. The data lives in
// `src/renderer/src/data/stockRecipes.ts` — the 5 curated
// starter recipes the Dashboard renders. The interface is
// re-exported by the design-system file; we import it from
// there for a single source of truth.
import type { StockRecipe } from 'renderer/src/components/StockRecipeCard'
import { STOCK_RECIPES } from 'renderer/src/data/stockRecipes'
import {
  LayoutDashboard,
  BarChart3,
  PieChart,
  TrendingUp,
  Package,
  AlertTriangle,
  ShoppingCart,
  Scissors,
  ChevronUp,
  ChevronDown,
  Plus,
  PlayCircle,
  Sparkles,
} from 'lucide-react'

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
              className="fill-foreground/70 text-xs"
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
          <text className="fill-foreground/70 text-xs" x={152} y={24 + i * 18}>
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
  // 2026-07-26 wizard Week 6 (§8.3 + §5.5). The Dashboard renders
  // two new affordances above the inventory list:
  //  - "Resume last batch" — restores the most recent saved Recipe
  //    and routes the user into Stage 1 with the recipe's
  //    selections pre-filled.
  //  - "Try a starter recipe" — renders the curated STOCK_RECIPES
  //    list; tapping a card pre-fills the wizard with the recipe
  //    and routes the user into Stage 1 at step 0.
  // Both wire through the same `setProductType` / `setSelection` /
  // `setWizardEnabled` actions so a future `resumeLastInFlight` /
  // `rerunRecipe` store action can replace this Dashboard logic
  // without changing the rendering surface.
  const recipes = useAppStore(s => s.recipes)
  const setProductType = useAppStore(s => s.setProductType)
  const setSelection = useAppStore(s => s.setSelection)
  const setWizardEnabled = useAppStore(s => s.setWizardEnabled)

  const [showMoreStats, setShowMoreStats] = useState(false)

  // 2026-07-25 inventory audit: the inventory section is rendered
  // inline on the Dashboard, and the empty-state "Material on Hand"
  // stat card scrolls the user down to it. We track a ref to the
  // section so the scrollIntoView call focuses the right element
  // (the CTA inside the section), not just the next heading.
  const inventorySectionRef = useRef<HTMLDivElement | null>(null)
  const scrollToInventory = () => {
    inventorySectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  /* ---------------------------------------------------------------- */
  /* Resume last batch (Week 6, §8.3)                                  */
  /* ---------------------------------------------------------------- */

  // Mirror of the future `resumeLastInFlight` store action: scans
  // `recipes[]` for the most recent saved batch and returns
  // `{ branch, lastStep, name }` for the "Resume last" card. The
  // state-routing rein is landing the real action; until it lands
  // we compute the same shape inline so the Dashboard renders the
  // resume CTA today. `null` when no recipe exists (the default
  // for a fresh user) — the card hides itself in that case.
  const resumeCandidate = useMemo(() => {
    if (recipes.length === 0) return null
    // `recipes[]` is prepended in `addRecipe`, so index 0 IS the
    // most recent. Defensive sort by createdAt in case a future
    // migration re-orders the array.
    const sorted = [...recipes].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    )
    const latest = sorted[0]
    if (!latest) return null
    // `lastStep` is the wizard's current step at the time of the
    // recipe save. The Recipe type doesn't carry it explicitly;
    // the user picks up at `currentStep === 0` (the product-type
    // picker) and the wizard pre-fills the selections, so 0 is
    // the canonical "start of Stage 1" resume point.
    return {
      id: latest.id,
      name: latest.name,
      branch: latest.branch,
      lastStep: 0,
    }
  }, [recipes])

  /**
   * Resume CTA. Restores the recipe's `selections` into the
   * wizard, sets the product-type branch, opens the wizard, and
   * routes the user to the product-type picker (step 0) — the
   * selections are pre-filled but the user reviews them per
   * §8.3 ("pre-fills, doesn't skip").
   */
  const handleResume = () => {
    if (!resumeCandidate) return
    const recipe = recipes.find(r => r.id === resumeCandidate.id)
    if (!recipe) return
    setProductType(recipe.branch)
    // Copy the saved selections. `setSelection` accepts
    // `undefined` to clear a key, so a recipe with a partial
    // selections shape is safe to round-trip. `Object.entries`
    // returns `[string, unknown][]`; cast to the canonical
    // `setSelection` signature. Runtime values are well-shaped
    // — see the data file for the `WizardSelections`-shaped
    // literals.
    for (const [key, value] of Object.entries(recipe.selections)) {
      setSelection(
        key as Parameters<typeof setSelection>[0],
        value as Parameters<typeof setSelection>[1]
      )
    }
    setWizardEnabled(true)
    // The WizardScreen reads `wizard.currentStep` to know which
    // card to render active; the store doesn't expose a
    // `setCurrentStep` setter yet. Mutating the slice directly
    // via `setState` is the canonical pattern the wire-up memory
    // documents for state-routing lands.
    useAppStore.setState(state => ({
      wizard: { ...state.wizard, currentStep: 0 },
    }))
  }

  /**
   * Stock recipe CTA. Pre-fills the wizard with the recipe's
   * selections and routes to step 0 (per §8.3). Same write
   * surface as `handleResume`.
   */
  const handleStockRecipeSelect = (recipe: StockRecipe) => {
    setProductType(recipe.branch)
    // `Object.entries` returns `[string, unknown][]`. `setSelection`
    // expects a typed key — cast to the canonical key set. The
    // runtime values are well-shaped (the data file's recipe
    // literals match `WizardSelections[K]`), so the cast is
    // safe at runtime; the wider `Record<string, unknown>`
    // `selections` type on the design-system's `StockRecipe`
    // is just a contract concession to keep the data file
    // decoupled from the wizard slice.
    for (const [key, value] of Object.entries(recipe.selections)) {
      setSelection(
        key as Parameters<typeof setSelection>[0],
        value as Parameters<typeof setSelection>[1]
      )
    }
    setWizardEnabled(true)
    useAppStore.setState(state => ({
      wizard: { ...state.wizard, currentStep: 0 },
    }))
  }

  // 2026-07-26 wizard Week 6: clear the `wizardEnabled` flag on
  // unmount so the wizard doesn't accidentally re-render the
  // next time the user lands on the Dashboard after a different
  // flow. The flag is persisted (per `appStore.setWizardEnabled`),
  // so an explicit clear is required to avoid leaking the
  // flag across tab switches. The Stage 1 wizard
  // (`wizardEnabled: true`) is the entry point; the Dashboard
  // itself is the entry point when the user lands on it
  // unprompted.
  useEffect(() => {
    return () => {
      // No-op on unmount — the flag persists so the user's
      // opt-in survives a tab switch. The `setWizardEnabled`
      // action lives in the store; the Dashboard does not flip
      // it back off on unmount.
    }
  }, [])

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

  const StatCard = ({
    label,
    value,
    icon,
    accentClass,
    onClick,
    ariaLabel,
  }: {
    label: string
    value?: string
    icon: React.ReactNode
    accentClass?: string
    /**
     * Optional click handler — when present, the card becomes a
     * button. Used by the "Material on Hand" stat to scroll to the
     * inventory section when the inventory is empty.
     */
    onClick?: () => void
    /**
     * Accessible name for the button-mode card. The default
     * `<span>` mode reads the visible text; the button mode needs
     * an explicit name so screen-readers don't read "button" with
     * no context. (Audit M7 pattern: icon-only / button-only
     * affordances must be unambiguous.)
     */
    ariaLabel?: string
  }) => {
    const inner = (
      <>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
              accentClass || 'bg-foreground/5'
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 text-xs font-medium uppercase tracking-wider text-foreground/70">
            {label}
          </span>
        </div>
        {value !== undefined ? (
          <span className="break-words text-2xl font-bold leading-tight text-foreground">
            {value}
          </span>
        ) : (
          <div className="flex items-center gap-1.5 self-start text-sm font-semibold text-success">
            <Plus aria-hidden="true" className="size-3.5" />
            Add your first batch
          </div>
        )}
      </>
    )

    if (onClick) {
      return (
        <button
          aria-label={ariaLabel ?? `Add your first ${label.toLowerCase()}`}
          className="flex min-h-[88px] min-w-0 cursor-pointer flex-col items-start gap-2 rounded-2xl border border-foreground/10 bg-foreground/5 p-4 text-left transition-colors hover:bg-foreground/10"
          data-testid={`dashboard-stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
          onClick={onClick}
          type="button"
        >
          {inner}
        </button>
      )
    }

    return (
      <div
        className="flex min-w-0 flex-col gap-2 rounded-2xl border border-foreground/10 bg-foreground/5 p-4"
        data-testid={`dashboard-stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {inner}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-5 p-2 sm:p-4">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <LayoutDashboard className="size-5 text-foreground/70" />
          <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>
        </div>
      </div>

      {/* Low-stock alert */}
      {inventoryTotals.lowStock && (
        <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 sm:items-center">
          <AlertTriangle className="size-5 shrink-0 text-warning" />
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-warning">
              Low Stock Alert
            </span>
            <span className="break-words text-xs text-warning/70">
              Material on hand ({fmt1(inventoryTotals.onHand)} g) is below the
              threshold of {fmt1(inventoryTotals.threshold)} g.
            </span>
          </div>
        </div>
      )}

      {/* Primary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          accentClass="bg-success/10"
          icon={<BarChart3 className="size-4 text-success" />}
          label="Total Batches"
          value={String(stats.totalBatches)}
        />
        <StatCard
          accentClass="bg-success/10"
          icon={<TrendingUp className="size-4 text-success" />}
          label="This Month"
          value={String(stats.monthBatches)}
        />
        <StatCard
          accentClass="bg-info/10"
          icon={<TrendingUp className="size-4 text-info" />}
          label="Avg Potency"
          value={`${fmt1(stats.avgPotency)} mg/serving`}
        />
        <StatCard
          accentClass="bg-violet-400/10"
          icon={<Package className="size-4 text-violet-400" />}
          label="Total THC"
          value={`${fmt1(stats.totalThc)} mg`}
        />
        <StatCard
          accentClass="bg-warning/10"
          icon={<BarChart3 className="size-4 text-warning" />}
          label="Most Used Method"
          value={stats.mostUsedMethod || '-'}
        />
        <StatCard
          accentClass="bg-success/10"
          ariaLabel="Add your first batch to inventory"
          icon={<Package className="size-4 text-success" />}
          label="Material on Hand"
          // 2026-07-25 inventory audit (BLOCKER B4): the audit
          // found this stat was always 0.0g because the inventory
          // was empty. Don't lie to the user — when the inventory
          // is empty, surface the empty-state CTA here AND in the
          // inventory section itself. The same CTA scrolls the
          // user down to the form; the inventory section is
          // rendered below this grid (see the `inventorySectionRef`
          // hook above).
          onClick={inventory.items.length === 0 ? scrollToInventory : undefined}
          value={
            inventory.items.length === 0
              ? undefined
              : `${fmt1(inventoryTotals.onHand)} g`
          }
        />
      </div>

      {/* Inventory section — the write-side UI for the
          `addInventoryItem` / `deleteInventoryItem` /
          `setInventory` store actions. The 2026-07-25 audit
          (BLOCKER B4) flagged this as the last missing UI on the
          write side of the inventory slice. */}
      <div ref={inventorySectionRef}>
        <InventorySection />
      </div>

      {/* 2026-07-26 wizard Week 6 (§8.3) — Resume last batch
          card. Renders only when at least one saved Recipe
          exists. The CTA restores the recipe's selections into
          the wizard and routes the user to the product-type
          picker (step 0). The card hides itself (returns `null`)
          when `resumeCandidate` is null so a fresh user (no
          saved Recipe yet) sees no broken/empty CTA. */}
      {resumeCandidate && (
        <div
          className="flex min-w-0 flex-col gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          data-testid="dashboard-resume-card"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15">
              <PlayCircle
                aria-hidden="true"
                className="size-5 text-emerald-400"
              />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-foreground">
                Resume your last batch
              </span>
              <span
                className="break-words text-xs text-foreground/70"
                data-testid="dashboard-resume-card-summary"
              >
                {resumeCandidate.name} · {resumeCandidate.branch} (step{' '}
                {resumeCandidate.lastStep})
              </span>
            </div>
          </div>
          <button
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-400/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            data-testid="dashboard-resume-card-cta"
            onClick={handleResume}
            type="button"
          >
            Resume
          </button>
        </div>
      )}

      {/* 2026-07-26 wizard Week 6 (§8.3) — Stock recipes section.
          Renders the curated STOCK_RECIPES list as
          `StockRecipeCard` items. Tapping a card pre-fills the
          wizard's selections with the recipe and routes the user
          to the product-type picker (step 0). Per §8.3, the
          wizard pre-fills — it does NOT skip — so the user
          reviews every pre-filled step before transitioning to
          Stage 2. The list is grid'd 1-col on mobile, 2-col on
          tablet, 3-col on desktop. */}
      <div
        className="flex min-w-0 flex-col gap-3"
        data-testid="dashboard-stock-recipes-section"
      >
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="size-4 text-foreground/70" />
          <h3 className="text-sm font-semibold text-foreground/80">
            Try a starter recipe
          </h3>
        </div>
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="dashboard-stock-recipes-list"
        >
          {STOCK_RECIPES.map(recipe => (
            <StockRecipeCard
              key={recipe.id}
              onSelect={handleStockRecipeSelect}
              recipe={recipe}
            />
          ))}
        </div>
      </div>

      {/* More Stats toggle */}
      <button
        aria-controls="dashboard-secondary-stats"
        aria-expanded={showMoreStats}
        className="flex w-full items-center justify-between rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
        onClick={() => setShowMoreStats(v => !v)}
        type="button"
      >
        <span>More Stats</span>
        {showMoreStats ? (
          <ChevronUp className="size-4" />
        ) : (
          <ChevronDown className="size-4" />
        )}
      </button>

      {/* Secondary stats */}
      {showMoreStats && (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          id="dashboard-secondary-stats"
        >
          <StatCard
            accentClass="bg-warning/10"
            icon={<TrendingUp className="size-4 text-warning" />}
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
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
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

        <div className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
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

        <div className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5">
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

      {/* Disclaimer */}
      <p className="text-center text-xs leading-relaxed text-foreground/70">
        Estimates are heuristic approximations, not laboratory results. Actual
        potency varies with material quality, technique, and measurement
        accuracy.
      </p>
    </div>
  )
}
