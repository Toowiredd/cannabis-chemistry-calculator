import { useMemo } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'
import { DECARB_METHODS } from 'renderer/src/engine/models'
import {
  needlePosition,
  zoneColor,
  tradeOffSentence,
  zoneTooltip,
  needleGlow,
  isOutOfRange,
  ZONE_RATIOS,
  MIN_TEMP,
  type HeatmapZone,
} from './heatmapGeometry'

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const ZONE_STYLES: Record<
  HeatmapZone,
  { bg: string; bgLight: string; label: string }
> = {
  green: {
    bg: 'rgba(16,185,129,0.28)',
    bgLight: 'rgba(16,185,129,0.18)',
    label: 'Terpene Preserving',
  },
  yellow: {
    bg: 'rgba(245,158,11,0.28)',
    bgLight: 'rgba(245,158,11,0.18)',
    label: 'Standard Decarb',
  },
  red: {
    bg: 'rgba(239,68,68,0.28)',
    bgLight: 'rgba(239,68,68,0.18)',
    label: 'Degradation Risk',
  },
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function DecarbHeatmap() {
  const decarb = useAppStore(s => s.decarb)
  const units = useAppStore(s => s.units)

  const preset = useMemo(
    () =>
      DECARB_METHODS.find(m => m.id === decarb.presetId) ?? DECARB_METHODS[0],
    [decarb.presetId]
  )

  /* Effective temperature in Celsius */
  const tempC = useMemo(() => {
    if (decarb.tempOverride != null) {
      const v = parseFloat(decarb.tempOverride)
      if (!Number.isNaN(v)) {
        return units.tempUnit === 'F' ? (v - 32) * (5 / 9) : v
      }
    }
    return preset.tempC
  }, [decarb.tempOverride, preset.tempC, units.tempUnit])

  const isOverridden = decarb.tempOverride != null
  const pos = needlePosition(tempC)
  const zone = zoneColor(tempC)
  const sentence = tradeOffSentence(tempC, preset, isOverridden)
  const glow = needleGlow(zone)
  const outOfRange = isOutOfRange(tempC)

  return (
    <figure
      aria-label="Temperature heatmap"
      className="glass glass-shine relative flex flex-col gap-3 rounded-2xl p-5 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
          Temperature Danger Zone
        </span>
        <span className="text-xs text-foreground/50">{tempC.toFixed(0)}°C</span>
      </div>

      {/* Out-of-range warning */}
      {outOfRange && (
        <div
          className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-300"
          role="alert"
        >
          {tempC < MIN_TEMP
            ? `Temperature ${tempC.toFixed(0)}°C is below the practical decarb floor (73°C). Decarboxylation will be extremely slow.`
            : `Temperature ${tempC.toFixed(0)}°C exceeds the safe decarb ceiling (130°C). THC degrades to CBN faster than THCA converts.`}
        </div>
      )}

      {/* Bar */}
      <div
        aria-label="Temperature bar from 73 to 130 degrees celsius"
        className="relative flex h-5 w-full rounded-full overflow-hidden"
        role="img"
      >
        {/* Green zone */}
        <span
          className="h-full block"
          style={{
            flexGrow: ZONE_RATIOS.green,
            background: ZONE_STYLES.green.bg,
          }}
          title={zoneTooltip('green')}
        />
        {/* Yellow zone */}
        <span
          className="h-full block"
          style={{
            flexGrow: ZONE_RATIOS.yellow,
            background: ZONE_STYLES.yellow.bg,
          }}
          title={zoneTooltip('yellow')}
        />
        {/* Red zone */}
        <span
          className="h-full block"
          style={{
            flexGrow: ZONE_RATIOS.red,
            background: ZONE_STYLES.red.bg,
          }}
          title={zoneTooltip('red')}
        />

        {/* Boundary markers */}
        <div
          className="absolute top-0 bottom-0 w-px bg-foreground/20"
          style={{ left: `${(ZONE_RATIOS.green / 57) * 100}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-foreground/20"
          style={{
            left: `${((ZONE_RATIOS.green + ZONE_RATIOS.yellow) / 57) * 100}%`,
          }}
        />

        {/* Needle */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 -translate-y-1/2 motion-reduce:transition-none"
          style={{
            left: `${pos}%`,
            transform: 'translate(-50%, -50%)',
            transition: 'left 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: 'transform',
          }}
        >
          {/* Needle shaft */}
          <div className="h-7 w-0.5 bg-foreground/90" />
          {/* Needle head / glow */}
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full"
            style={{
              width: '10px',
              height: '10px',
              background: glow,
              boxShadow: `0 0 8px 3px ${glow}`,
            }}
          />
        </div>
      </div>

      {/* Zone labels */}
      <div className="flex justify-between text-[10px] font-medium text-foreground/50">
        <span className="flex-1 text-left">{ZONE_STYLES.green.label}</span>
        <span className="flex-1 text-center">{ZONE_STYLES.yellow.label}</span>
        <span className="flex-1 text-right">{ZONE_STYLES.red.label}</span>
      </div>

      {/* Dynamic sentence */}
      <p
        aria-live="polite"
        className="text-xs leading-relaxed text-foreground/70"
      >
        {sentence}
      </p>
    </figure>
  )
}
