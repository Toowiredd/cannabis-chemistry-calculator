import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import {
  type RadarScores,
  computeRadarScores,
  radarPoints,
  polygonPath,
  axisLabelPosition,
  ringRadii,
  RADAR_AXES,
} from 'renderer/src/engine/radarScores'
import { cn } from 'renderer/lib/utils'
import { ChevronDown, ChevronUp, Eye, EyeOff, BookOpen } from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const W = 260
const H = 260
const CX = W / 2
const CY = H / 2
const RADIUS = 90
const LABEL_PAD = 22

const RING_LABELS = ['0', '5', '10']

/* ------------------------------------------------------------------ */
/* Animated scores hook                                               */
/* ------------------------------------------------------------------ */

function useAnimatedScores(target: RadarScores, enabled: boolean): RadarScores {
  const [current, setCurrent] = useState<RadarScores>(target)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const fromRef = useRef<RadarScores>(target)

  const animate = useCallback(
    (timestamp: number) => {
      if (startRef.current == null) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const duration = 550 // ms — matches spring feel
      const t = Math.min(1, elapsed / duration)
      // ease-out cubic — spring-like landing
      const eased = 1 - (1 - t) ** 3

      const from = fromRef.current
      setCurrent({
        thcDose: from.thcDose + (target.thcDose - from.thcDose) * eased,
        cbdDose: from.cbdDose + (target.cbdDose - from.cbdDose) * eased,
        onsetSpeed:
          from.onsetSpeed + (target.onsetSpeed - from.onsetSpeed) * eased,
        duration: from.duration + (target.duration - from.duration) * eased,
        bodyLoad: from.bodyLoad + (target.bodyLoad - from.bodyLoad) * eased,
        headLoad: from.headLoad + (target.headLoad - from.headLoad) * eased,
      })

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        startRef.current = null
      }
    },
    [target]
  )

  useEffect(() => {
    if (!enabled) {
      setCurrent(target)
      return
    }
    // Start new animation from wherever current is
    fromRef.current = { ...current }
    startRef.current = null
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, enabled, animate, current])

  return current
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function DoseRadarChart() {
  const mgPerServingRaw = useAppStore(s => s.dose.totalThc)
  const servingsRaw = useAppStore(s => s.dose.servings)
  const decarb = useAppStore(s => s.decarb)
  const infusion = useAppStore(s => s.infusion)
  const isReverse = useAppStore(s => s.dose.reverseMode)
  const journalEntries = useAppStore(s => s.journalEntries)

  const [compareOpen, setCompareOpen] = useState(false)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)

  const reducedMotion = useReducedMotion()

  /* -- Derive valid mgPerServing -- */
  const mgPerServing = useMemo(() => {
    const total = parseFloat(mgPerServingRaw)
    const servings = parseFloat(servingsRaw)
    if (
      !Number.isFinite(total) ||
      total <= 0 ||
      !Number.isFinite(servings) ||
      servings <= 0
    )
      return null
    return total / servings
  }, [mgPerServingRaw, servingsRaw])

  /* -- Current scores -- */
  const currentScores: RadarScores = useMemo(() => {
    if (mgPerServing == null || isReverse) {
      return {
        thcDose: 0,
        cbdDose: 0,
        onsetSpeed: 0,
        duration: 0,
        bodyLoad: 0,
        headLoad: 0,
      }
    }
    return computeRadarScores({
      mgPerServing,
      cbdaPct: parseFloat(decarb.cbdaPct) || 0,
      cbdPct: parseFloat(decarb.cbdPct) || 0,
      weight: parseFloat(decarb.weight) || 0,
      fatId: infusion.fatId,
      customEfficiency: infusion.customEfficiency || null,
      methodId: decarb.presetId,
      servings: parseFloat(servingsRaw) || 1,
    })
  }, [mgPerServing, isReverse, decarb, infusion, servingsRaw])

  /* -- Animated scores -- */
  const animatedScores = useAnimatedScores(currentScores, !reducedMotion)

  /* -- Comparison scores -- */
  const comparisonScores: RadarScores | null = useMemo(() => {
    if (!compareOpen) return null
    const entry =
      selectedEntryId != null
        ? journalEntries.find(e => e.id === selectedEntryId)
        : journalEntries[0]
    if (!entry) return null

    const entryMg = parseFloat(entry.mgPerServing)
    if (!Number.isFinite(entryMg) || entryMg <= 0) return null

    return computeRadarScores({
      mgPerServing: entryMg,
      cbdaPct: parseFloat(entry.thcaPct) || 0,
      cbdPct: parseFloat(entry.cbdPct) || 0,
      weight: parseFloat(entry.materialWeight) || 0,
      fatId: entry.fatId,
      customEfficiency: null,
      methodId: entry.methodId,
      servings: parseFloat(entry.servings) || 1,
    })
  }, [compareOpen, selectedEntryId, journalEntries])

  /* -- Geometry -- */
  const rings = useMemo(() => ringRadii(RING_LABELS, 10, RADIUS), [])

  const currentPoints = useMemo(
    () =>
      radarPoints(
        [
          animatedScores.thcDose,
          animatedScores.cbdDose,
          animatedScores.onsetSpeed,
          animatedScores.duration,
          animatedScores.bodyLoad,
          animatedScores.headLoad,
        ],
        CX,
        CY,
        RADIUS
      ),
    [animatedScores]
  )

  const currentPath = useMemo(() => polygonPath(currentPoints), [currentPoints])

  const comparisonPoints = useMemo(() => {
    if (!comparisonScores) return null
    return radarPoints(
      [
        comparisonScores.thcDose,
        comparisonScores.cbdDose,
        comparisonScores.onsetSpeed,
        comparisonScores.duration,
        comparisonScores.bodyLoad,
        comparisonScores.headLoad,
      ],
      CX,
      CY,
      RADIUS
    )
  }, [comparisonScores])

  const comparisonPath = useMemo(() => {
    if (!comparisonPoints) return null
    return polygonPath(comparisonPoints)
  }, [comparisonPoints])

  /* -- Visibility guards -- */
  const hasValidData = mgPerServing != null && !isReverse

  if (!hasValidData) {
    return (
      <div className="glass glass-shine relative flex flex-col gap-3 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
            Experience Profile
          </span>
        </div>
        <p className="text-sm text-foreground/50">
          {isReverse
            ? 'Reverse mode calculates required material, not an experience profile.'
            : 'Enter total infused THC and servings to see your dose profile.'}
        </p>
      </div>
    )
  }

  return (
    <div className="glass glass-shine relative flex flex-col gap-3 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
          Experience Profile
        </span>
        <span className="text-xs text-foreground/50">
          {mgPerServing.toFixed(1)} mg/serving
        </span>
      </div>

      {/* Radar SVG */}
      <div className="relative flex items-center justify-center">
        <svg
          aria-label="Radar chart showing six dimensions of dose experience"
          className="w-full max-w-[280px]"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
        >
          {/* Background grid rings */}
          {rings.map(r => (
            <circle
              cx={CX}
              cy={CY}
              fill="none"
              key={`ring-${r.toFixed(1)}`}
              r={r}
              stroke="rgba(255,255,255,0.12)"
              strokeDasharray="2 3"
              strokeWidth="1"
            />
          ))}

          {/* Axis spokes */}
          {RADAR_AXES.map((axis, i) => {
            const end = axisLabelPosition(i, 6, CX, CY, RADIUS, 0)
            return (
              <line
                key={`spoke-${axis.key}`}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1"
                x1={CX}
                x2={end.x}
                y1={CY}
                y2={end.y}
              />
            )
          })}

          {/* Ring value labels */}
          {RING_LABELS.slice(1).map((label, i) => {
            const r = rings[i + 1] // +1 because rings[0] is the radius for label '0'
            return (
              <text
                className="fill-foreground/40 text-[8px] font-medium tabular-nums"
                key={`ring-label-${label}`}
                textAnchor="middle"
                x={CX}
                y={CY - r - 2}
              >
                {label}
              </text>
            )
          })}

          {/* Comparison polygon (behind) */}
          {comparisonPath && (
            <g
              aria-label="Comparison polygon from journal entry"
              style={{
                transition: reducedMotion
                  ? 'none'
                  : 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <path
                d={comparisonPath}
                fill="rgba(200,200,255,0.10)"
                stroke="rgba(200,200,255,0.45)"
                strokeDasharray="4 3"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Current polygon */}
          <g
            aria-label="Current dose experience polygon"
            style={{
              transition: reducedMotion ? 'none' : 'opacity 0.3s ease',
            }}
          >
            <path
              d={currentPath}
              fill="rgba(20,184,166,0.18)"
              stroke="#14b8a6"
              strokeLinejoin="round"
              strokeWidth="2"
            />

            {/* Vertex dots */}
            {currentPoints.map((p, i) => (
              <circle
                cx={p.x}
                cy={p.y}
                fill="#14b8a6"
                key={`dot-${RADAR_AXES[i].key}`}
                r="3"
                style={{
                  transition: reducedMotion
                    ? 'none'
                    : 'cx 0.5s cubic-bezier(0.16, 1, 0.3, 1), cy 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            ))}
          </g>

          {/* Axis labels */}
          {RADAR_AXES.map((axis, i) => {
            const pos = axisLabelPosition(i, 6, CX, CY, RADIUS, LABEL_PAD)
            // Hide CBD label when score is 0 and there's no CBD data
            const scoreVal = animatedScores[axis.key as keyof RadarScores]
            const hideCbd = axis.key === 'cbdDose' && scoreVal <= 0
            return (
              <text
                className={cn(
                  'text-[8px] font-semibold uppercase tracking-wider',
                  hideCbd ? 'fill-foreground/20' : 'fill-foreground/70'
                )}
                key={`label-${axis.key}`}
                textAnchor="middle"
                x={pos.x}
                y={pos.y}
              >
                {hideCbd ? `${axis.label} (0)` : axis.label}
              </text>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#14b8a6]" />
          <span className="text-[10px] font-medium text-foreground/60">
            Current
          </span>
        </div>
        {comparisonPath && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[rgba(200,200,255,0.6)]" />
            <span className="text-[10px] font-medium text-foreground/60">
              {selectedEntryId
                ? (journalEntries.find(e => e.id === selectedEntryId)?.date ??
                  'Journal')
                : 'Latest Journal'}
            </span>
          </div>
        )}
      </div>

      {/* Comparison toggle */}
      <div className="mt-1">
        <button
          className="flex w-full items-center justify-between rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
          onClick={() => setCompareOpen(v => !v)}
          type="button"
        >
          <span className="flex items-center gap-1.5">
            {compareOpen ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
            {compareOpen ? 'Hide Comparison' : 'Compare with Journal'}
          </span>
          {compareOpen ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>

        {compareOpen && (
          <div className="mt-2 flex flex-col gap-2">
            {journalEntries.length === 0 ? (
              <div className="flex flex-col items-center gap-1 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-4">
                <BookOpen className="size-5 text-foreground/30" />
                <span className="text-xs text-foreground/50">
                  No journal entries yet. Save a batch to compare.
                </span>
              </div>
            ) : (
              <select
                className="w-full rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs text-foreground outline-none"
                onChange={e =>
                  setSelectedEntryId(
                    e.target.value === '' ? null : e.target.value
                  )
                }
                value={selectedEntryId ?? ''}
              >
                <option className="bg-card text-foreground" value="">
                  Latest entry
                </option>
                {journalEntries.map(entry => (
                  <option
                    className="bg-card text-foreground"
                    key={entry.id}
                    value={entry.id}
                  >
                    {entry.date} — {entry.mgPerServing} mg/serving
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
