/* ------------------------------------------------------------------ */
/* MolecularBuilder geometry helpers                                */
/* ------------------------------------------------------------------ */

export interface MoleculePhase {
  name: string
  start: number
  end: number
}

export const PHASES: MoleculePhase[] = [
  { name: 'fadeIn', start: 0, end: 0.125 },
  { name: 'carboxylPulse', start: 0.125, end: 0.25 },
  { name: 'vibration', start: 0.25, end: 0.375 },
  { name: 'detachment', start: 0.375, end: 0.5 },
  { name: 'rearrangement', start: 0.5, end: 0.625 },
  { name: 'co2Float', start: 0.625, end: 0.75 },
  { name: 'thcLabel', start: 0.75, end: 0.875 },
  { name: 'caption', start: 0.875, end: 1.0 },
]

export const COLOR_THCA = '#7a8b7a'
export const COLOR_AMBER = '#f59e0b'
export const COLOR_THC = '#14b8a6'
export const COLOR_CO2 = '#3b82f6'
export const COLOR_BOND = 'rgba(255,255,255,0.4)'

/* ------------------------------------------------------------------ */
/* Phase computation                                                  */
/* ------------------------------------------------------------------ */

export function getPhaseName(progress: number): string {
  for (const p of PHASES) {
    if (progress >= p.start && progress < p.end) return p.name
  }
  return 'completed'
}

export function getPhaseIndex(progress: number): number {
  for (let i = 0; i < PHASES.length; i++) {
    if (progress < PHASES[i].end) return i
  }
  return PHASES.length
}

/* ------------------------------------------------------------------ */
/* Easing helpers                                                     */
/* ------------------------------------------------------------------ */

export function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v))
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/* ------------------------------------------------------------------ */
/* Hexagon point generator                                            */
/* ------------------------------------------------------------------ */

export interface Point {
  x: number
  y: number
}

export function hexPoints(cx: number, cy: number, r: number): Point[] {
  const pts: Point[] = []
  for (let i = 0; i < 6; i++) {
    const a = ((i * 60 - 30) * Math.PI) / 180
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return pts
}

export function pointsToStr(pts: Point[]): string {
  return pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}

/* ------------------------------------------------------------------ */
/* Ring positions (shared-vertex hexagons)                          */
/* ------------------------------------------------------------------ */

export const HEX_RADIUS = 38

export function getRing1Base(): Point {
  return { x: 140, y: 130 }
}
export function getRing2Base(): Point {
  return { x: 202, y: 130 }
}
export function getRing3Base(): Point {
  return { x: 202, y: 66 }
}

/* ------------------------------------------------------------------ */
/* Element transforms at a given progress (0-1)                     */
/* ------------------------------------------------------------------ */

export interface MoleculeTransforms {
  moleculeOpacity: number
  ring1Translate: Point
  ring2Translate: Point
  ring3Translate: Point
  ringColor: string
  carboxylTranslate: Point
  carboxylOpacity: number
  bondOpacity: number
  co2LabelOpacity: number
  co2LabelTranslate: Point
  thcaLabelOpacity: number
  thcLabelOpacity: number
  thcLabelTranslate: Point
  captionOpacity: number
  vibrationOffset: Point
  glowIntensity: number
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const bigint = Number.parseInt(h, 16)
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)}`
}

export function interpolateColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1)
  const [r2, g2, b2] = hexToRgb(c2)
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t))
}

export function computeTransforms(progress: number): MoleculeTransforms {
  const p = clamp(progress)

  // Always full opacity (entrance is handled at card level, not molecule level)
  const moleculeOpacity = 1

  // Vibration (25-37.5%)
  let vibrationOffset: Point = { x: 0, y: 0 }
  if (p >= 0.25 && p < 0.375) {
    const vt = (p - 0.25) / 0.125
    // deterministic pseudo-random jitter using sin
    const phase = p * 80
    vibrationOffset = {
      x: Math.sin(phase * 12) * 2 * (1 - vt * 0.5),
      y: Math.cos(phase * 14) * 2 * (1 - vt * 0.5),
    }
  } else if (p >= 0.375 && p < 0.5) {
    const vt = (p - 0.375) / 0.125
    const phase = p * 80
    vibrationOffset = {
      x: Math.sin(phase * 12) * 2 * (1 - vt),
      y: Math.cos(phase * 14) * 2 * (1 - vt),
    }
  }

  // Glow/pulse (12.5-37.5%)
  let glowIntensity = 0
  if (p >= 0.125 && p < 0.375) {
    const gt = (p - 0.125) / 0.25
    glowIntensity = Math.sin(gt * Math.PI * 3) * 0.5 + 0.5
  }

  // Detachment (37.5-50%)
  let carboxylTranslate: Point = { x: 0, y: 0 }
  let bondOpacity = 1
  if (p >= 0.375) {
    const dt = clamp((p - 0.375) / 0.125)
    carboxylTranslate = {
      x: dt * 20,
      y: -(dt * 40),
    }
    bondOpacity = 1 - easeOutCubic(dt)
  }

  // Rearrangement + color transition (50-62.5%)
  let ring1Translate: Point = { x: 0, y: 0 }
  let ring2Translate: Point = { x: 0, y: 0 }
  let ring3Translate: Point = { x: 0, y: 0 }
  let ringColor = COLOR_THCA
  if (p >= 0.5) {
    const rt = clamp((p - 0.5) / 0.125)
    const smooth = easeInOutCubic(rt)
    ring1Translate = { x: smooth * -3, y: smooth * 4 }
    ring2Translate = { x: smooth * 2, y: smooth * -2 }
    ring3Translate = { x: smooth * 4, y: smooth * 3 }
    ringColor = interpolateColor(COLOR_THCA, COLOR_THC, smooth)
  }

  // CO₂ float + label (62.5-75%)
  let co2LabelOpacity = 0
  let co2LabelTranslate: Point = { x: 0, y: 0 }
  let carboxylOpacity = 1
  if (p >= 0.625) {
    const ct = clamp((p - 0.625) / 0.125)
    carboxylTranslate = {
      x: 20 + ct * 10,
      y: -40 - ct * 60,
    }
    co2LabelOpacity = ct > 0.2 ? easeOutCubic((ct - 0.2) / 0.8) : 0
    co2LabelTranslate = { x: 30 + ct * 15, y: -90 - ct * 40 }
    carboxylOpacity = 1 - ct * 0.3 // slight fade as it becomes CO₂
  }

  // THCA label fades gradually (62.5-75%)
  let thcaLabelOpacity = 1
  if (p >= 0.625) {
    const tht = clamp((p - 0.625) / 0.125)
    thcaLabelOpacity = 1 - easeOutCubic(tht)
  }

  // THC label (75-87.5%)
  let thcLabelOpacity = 0
  let thcLabelTranslate: Point = { x: 0, y: 10 }
  if (p >= 0.75) {
    const tt = clamp((p - 0.75) / 0.125)
    thcLabelOpacity = easeOutCubic(tt)
    thcLabelTranslate = { x: 0, y: lerp(10, 0, tt) }
  }

  // Caption (87.5-100%)
  let captionOpacity = 0
  if (p >= 0.875) {
    const cpt = clamp((p - 0.875) / 0.125)
    captionOpacity = easeOutCubic(cpt)
  }

  return {
    moleculeOpacity,
    ring1Translate,
    ring2Translate,
    ring3Translate,
    ringColor,
    carboxylTranslate,
    carboxylOpacity,
    bondOpacity,
    co2LabelOpacity,
    co2LabelTranslate,
    thcaLabelOpacity,
    thcLabelOpacity,
    thcLabelTranslate,
    captionOpacity,
    vibrationOffset,
    glowIntensity,
  }
}
