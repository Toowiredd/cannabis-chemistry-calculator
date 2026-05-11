import { useMemo } from 'react'
import { useAppStore } from 'renderer/src/stores/appStore'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type VisualStage = 'landing' | 'decarb' | 'infusion' | 'dose'

interface Position {
  x: number
  y: number
}

interface HexData {
  id: number
  landingPos: Position
  clusterPos: Position
  gridPos: Position
  clusterId: number
  rotation: number
  floatDelay: number
  floatDuration: number
  amberDelay: number
  amberXOff: number
  amberR: number
  dropletDelay: number
  dropletXOff: number
  dropletYOff: number
  dropletR: number
  isAmberAccent: boolean
}

/* ------------------------------------------------------------------ */
/* Deterministic pseudo-random                                        */
/* ------------------------------------------------------------------ */

function prng(seed: number): number {
  const x = Math.sin(seed) * 43758.5453123
  return x - Math.floor(x)
}

/* ------------------------------------------------------------------ */
/* Constants & geometry                                               */
/* ------------------------------------------------------------------ */

const COLS = 6
const ROWS = 6
const HEX_RADIUS = 8.77

const CLUSTER_CENTERS: Position[] = [
  { x: 350, y: 280 },
  { x: 1300, y: 220 },
  { x: 800, y: 550 },
  { x: 350, y: 850 },
  { x: 1400, y: 750 },
  { x: 900, y: 950 },
]

function computeHexPoints(): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = ((i * 60 - 30) * Math.PI) / 180
    pts.push(
      `${(HEX_RADIUS * Math.cos(a)).toFixed(2)},${(HEX_RADIUS * Math.sin(a)).toFixed(2)}`
    )
  }
  return pts.join(' ')
}

/** Carboxyl circle position relative to hex centre (top vertex extended) */
function computeCarboxyl(): Position {
  const a = (-30 * Math.PI) / 180
  const r = HEX_RADIUS * 1.45
  return {
    x: Number((r * Math.cos(a)).toFixed(2)),
    y: Number((r * Math.sin(a)).toFixed(2)),
  }
}

/* ------------------------------------------------------------------ */
/* Generate hex data ONCE (module-level constant)                     */
/* ------------------------------------------------------------------ */

const HEX_POINTS = computeHexPoints()
const CARBOXYL = computeCarboxyl()

function generateHexData(): HexData[] {
  const result: HexData[] = []
  const colW = 300
  const rowH = 170

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const id = row * COLS + col
      const seed = id * 127 + 311

      // Grid position (dose stage)
      const gridX = 200 + col * colW
      const gridY = 100 + row * rowH

      // Landing position (scattered)
      const jx = (prng(seed) - 0.5) * 200
      const jy = (prng(seed + 73) - 0.5) * 150

      // Cluster position for infusion
      const clusterId = id % CLUSTER_CENTERS.length
      const cc = CLUSTER_CENTERS[clusterId]
      const cjx = (prng(seed + 199) - 0.5) * 140
      const cjy = (prng(seed + 347) - 0.5) * 120

      result.push({
        id,
        landingPos: { x: gridX + jx, y: gridY + jy },
        clusterPos: { x: cc.x + cjx, y: cc.y + cjy },
        gridPos: { x: gridX, y: gridY },
        clusterId,
        rotation: Math.round(prng(seed + 41) * 360),
        floatDelay: Math.round(prng(seed + 17) * 800) / 100,
        floatDuration: Math.round((6 + prng(seed + 53) * 6) * 100) / 100,
        amberDelay: Math.round(prng(seed + 89) * 400) / 100,
        amberXOff: (prng(seed + 201) - 0.5) * 10,
        amberR: prng(seed + 257) * 1.5 + 0.5,
        dropletDelay: Math.round(prng(seed + 131) * 300) / 100,
        dropletXOff: (prng(seed + 163) - 0.5) * 20,
        dropletYOff: (prng(seed + 197) - 0.5) * 16,
        dropletR: 2.5 + prng(seed + 229) * 2,
        isAmberAccent: id % 7 === 0,
      })
    }
  }
  return result
}

const HEX_DATA = generateHexData()

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function getPosition(data: HexData, stage: VisualStage): Position {
  switch (stage) {
    case 'dose':
      return data.gridPos
    case 'infusion':
      return data.clusterPos
    default:
      return data.landingPos
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function TransformationCanvas() {
  const activeTab = useAppStore(s => s.activeTab)
  const lastDecarbExpected = useAppStore(s => s.lastDecarbExpected)
  const lastInfusedThc = useAppStore(s => s.lastInfusedThc)
  const doseTotalThc = useAppStore(s => s.dose.totalThc)

  const stage = useMemo((): VisualStage => {
    if (activeTab === 'decarb' && lastDecarbExpected) return 'decarb'
    if (activeTab === 'infusion' && lastInfusedThc) return 'infusion'
    if (activeTab === 'dose' && (lastInfusedThc || doseTotalThc)) return 'dose'
    return 'landing'
  }, [activeTab, lastDecarbExpected, lastInfusedThc, doseTotalThc])

  const stageColors = useMemo(() => {
    switch (stage) {
      case 'landing':
        return {
          hex: 'rgba(20,184,166,0.06)',
          stroke: 'rgba(20,184,166,0.09)',
          carboxyl: 'rgba(20,184,166,0.07)',
        }
      case 'decarb':
        return {
          hex: 'rgba(217,119,6,0.07)',
          stroke: 'rgba(217,119,6,0.09)',
          carboxyl: 'rgba(217,119,6,0.05)',
        }
      case 'infusion':
        return {
          hex: 'rgba(245,158,11,0.07)',
          stroke: 'rgba(245,158,11,0.09)',
          carboxyl: 'rgba(245,158,11,0.04)',
        }
      default:
        return {
          hex: 'rgba(16,185,129,0.07)',
          stroke: 'rgba(16,185,129,0.09)',
          carboxyl: 'rgba(16,185,129,0.04)',
        }
    }
  }, [stage])

  const amberAccent = 'rgba(245,158,11,0.06)'

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden motion-reduce:hidden">
      <svg
        aria-hidden="true"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1920 1080"
      >
        <defs>
          <polygon id="chem-hex" points={HEX_POINTS} />
        </defs>

        {HEX_DATA.map(data => {
          const pos = getPosition(data, stage)
          const isDecarb = stage === 'decarb'
          const isInfusion = stage === 'infusion'
          const fill =
            stage === 'dose' && data.isAmberAccent
              ? amberAccent
              : stageColors.hex

          return (
            <g key={data.id}>
              {/* Position + layout transition */}
              <g
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  transition:
                    stage !== 'landing'
                      ? 'transform 1.6s cubic-bezier(0.16, 1, 0.3, 1)'
                      : 'none',
                }}
              >
                {/* Rotation layer */}
                <g style={{ transform: `rotate(${data.rotation}deg)` }}>
                  {/* Float animation layer */}
                  <g
                    style={{
                      animation: `chem-hex-float ${data.floatDuration}s ease-in-out infinite`,
                      animationDelay: `${data.floatDelay}s`,
                    }}
                  >
                    <use
                      fill={fill}
                      href="#chem-hex"
                      stroke={stageColors.stroke}
                      strokeWidth="0.5"
                    />

                    {/* Carboxyl group — hidden in dose, animated away in decarb */}
                    {stage !== 'dose' && (
                      <circle
                        cx={CARBOXYL.x}
                        cy={CARBOXYL.y}
                        fill={stageColors.carboxyl}
                        r="1.5"
                        style={
                          isDecarb
                            ? {
                                animation: `chem-carboxyl-detach 1.2s ease-out forwards`,
                                animationDelay: `${data.floatDelay}s`,
                              }
                            : undefined
                        }
                      />
                    )}
                  </g>
                </g>
              </g>

              {/* Amber particles — decarb stage only */}
              {isDecarb && (
                <circle
                  cx={pos.x + data.amberXOff}
                  cy={pos.y}
                  fill="rgba(217,119,6,0.15)"
                  r={data.amberR}
                  style={{
                    animation: 'chem-amber-rise 3.5s ease-out infinite',
                    animationDelay: `${data.amberDelay}s`,
                  }}
                />
              )}

              {/* Lipid droplets — infusion stage, every other cluster */}
              {isInfusion && data.clusterId % 2 === 0 && (
                <circle
                  cx={pos.x + data.dropletXOff}
                  cy={pos.y + data.dropletYOff}
                  fill="rgba(245,158,11,0.05)"
                  r={data.dropletR}
                  style={{
                    animation: 'chem-droplet-pulse 2.8s ease-in-out infinite',
                    animationDelay: `${data.dropletDelay}s`,
                  }}
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
