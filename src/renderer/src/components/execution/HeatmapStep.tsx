/**
 * HeatmapStep — Stage 2 visual-state shell (§4.1, "Visual state").
 *
 * Renders a wrapped `<DecarbHeatmap>` (the existing widget from
 * `src/renderer/src/components/DecarbHeatmap.tsx`) plus a
 * progress bar overlay that reflects the per-step completion
 * percentage.
 *
 * Week 2 (this commit): the shell accepts the prop contract
 * and renders the wrapped Heatmap + the progress overlay. The
 * actual data wiring — sourcing `targetTemp` from the Stage 1
 * selection and syncing `currentTemp` / `progressPct` with the
 * engine — lands in week 4. For now the underlying heatmap
 * reads from the `appStore` (its existing behavior); the
 * progress overlay is driven by the shell's `progressPct` prop
 * directly.
 */
import { DecarbHeatmap } from '../DecarbHeatmap'

export type HeatmapMaterial = 'flower' | 'concentrate' | 'avb'

export interface HeatmapStepProps {
  /** Target temperature in Celsius — rendered as a caption
   *  beside the heatmap so the user sees the goal. */
  targetTemp: number
  /** Current temperature in Celsius. For week 2 the underlying
   *  heatmap reads from appStore; week 4 wires this through. */
  currentTemp: number
  /** Per-step completion progress, 0-100. Drives the
   *  progress bar overlay. */
  progressPct: number
  /** Material being visualized. Rendered as a caption. */
  material: HeatmapMaterial
}

export function HeatmapStep({
  targetTemp,
  currentTemp,
  progressPct,
  material,
}: HeatmapStepProps) {
  const pct = clamp(progressPct, 0, 100)
  return (
    <div
      className="flex flex-col gap-2"
      data-current-temp={currentTemp}
      data-material={material}
      data-progress-pct={pct}
      data-target-temp={targetTemp}
      data-testid="heatmap-step"
    >
      {/* The wrapped DecarbHeatmap widget. The widget is global
          (reads from appStore) — for week 2 it's rendered as-is.
          The prop contract on this shell is the integration
          point that week 4 will use to drive the widget's state. */}
      <DecarbHeatmap />

      {/* Progress bar overlay. Visualizes the per-step
          completion percentage; the heatmap's needle is the
          molecular visualization. Together they answer "how
          far along am I?" + "what's happening to the
          material?". */}
      <div
        aria-label="Step progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={pct}
        className="flex flex-col gap-1"
        data-testid="heatmap-step-progress"
        role="progressbar"
      >
        <div className="flex items-center justify-between text-[11px] text-foreground/60">
          <span>
            Target: {targetTemp}°C · {material}
          </span>
          <span data-testid="heatmap-step-progress-pct">{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            data-testid="heatmap-step-progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return Math.max(lo, Math.min(hi, n))
}
