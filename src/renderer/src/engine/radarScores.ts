/**
 * Radar chart geometry and score calculations.
 * Pure TypeScript — zero UI imports.
 */

import { INFUSION_FATS } from './models'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface RadarScores {
  /** 0–10 score for THC dose axis */
  thcDose: number
  /** 0–10 score for CBD dose axis */
  cbdDose: number
  /** 0–10 score for onset speed (higher = faster) */
  onsetSpeed: number
  /** 0–10 score for duration (higher = longer) */
  duration: number
  /** 0–10 score for body load */
  bodyLoad: number
  /** 0–10 score for head load */
  headLoad: number
}

export interface RadarPoint {
  x: number
  y: number
}

/* ------------------------------------------------------------------ */
/* Score helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Piecewise linear interpolation through anchor points.
 * Anchors must be sorted ascending by x.
 */
// TODO(citation): piecewise anchor thresholds (0, 2.5, 5, 10, 25, 50, 100)
// reuse the dosing classification boundaries (see dosing.ts) — internal UI
// taxonomy. See research/academic-references.md audit row #28.
export function piecewiseScore(
  value: number,
  anchors: [number, number][]
): number {
  if (anchors.length === 0) return 0
  if (value <= anchors[0][0]) return anchors[0][1]
  if (value >= anchors[anchors.length - 1][0])
    return anchors[anchors.length - 1][1]

  for (let i = 0; i < anchors.length - 1; i++) {
    const [x0, y0] = anchors[i]
    const [x1, y1] = anchors[i + 1]
    if (value >= x0 && value <= x1) {
      const t = x1 === x0 ? 0 : (value - x0) / (x1 - x0)
      return y0 + t * (y1 - y0)
    }
  }
  return anchors[anchors.length - 1][1]
}

/**
 * THC dose score based on mg per serving.
 * Maps classification boundaries to a 0–10 scale.
 */
export function thcDoseScore(mgPerServing: number): number {
  if (!Number.isFinite(mgPerServing) || mgPerServing <= 0) return 0
  return piecewiseScore(mgPerServing, [
    [0, 0],
    [2.5, 2],
    [5, 3],
    [10, 4],
    [25, 6],
    [50, 8],
    [100, 10],
  ])
}

/**
 * CBD dose score based on estimated CBD mg per serving.
 */
export function cbdDoseScore(
  weight: number,
  cbdaPct: number,
  cbdPct: number,
  extractionEff: number,
  servings: number
): number {
  if (
    !Number.isFinite(weight) ||
    weight <= 0 ||
    !Number.isFinite(servings) ||
    servings <= 0
  )
    return 0
  // 0.877 MW ratio per Filer 2022 (#1, see research/academic-references.md).
  const cbdTheoreticalMax =
    weight * ((cbdaPct / 100) * 0.877 + cbdPct / 100) * 1000
  const cbdMgPerServing = (cbdTheoreticalMax * extractionEff) / servings
  if (!Number.isFinite(cbdMgPerServing) || cbdMgPerServing <= 0) return 0
  return Math.min(10, Math.max(0, cbdMgPerServing))
}

/**
 * Onset speed score (higher = faster onset).
 * MCT oil absorbs fastest; high doses slow absorption.
 *
 * TODO(citation): base scores `{mct:9, ghee:7, coconut:6, custom:5}` and the
 * `mgPerServing / 25` penalty divisor are engineering heuristics; no peer-
 * reviewed source maps specific carrier fats to these numeric onset scores.
 * See research/academic-references.md audit row #29.
 */
export function onsetSpeedScore(mgPerServing: number, fatId: string): number {
  const base: Record<string, number> = {
    mct: 9,
    ghee: 7,
    coconut: 6,
    custom: 5,
  }
  const b = base[fatId] ?? 5
  if (!Number.isFinite(mgPerServing) || mgPerServing <= 0) return b
  const penalty = Math.min(4, mgPerServing / 25)
  return Math.max(1, b - penalty)
}

/**
 * Duration score (higher = longer lasting).
 * Saturated fats (ghee, coconut) prolong effects; higher dose = longer.
 *
 * TODO(citation): base scores `{mct:5, ghee:9, coconut:8.5, custom:6}` and the
 * `mgPerServing / 50` bonus divisor are engineering heuristics; no peer-
 * reviewed source maps specific carrier fats to these numeric duration
 * scores. See research/academic-references.md audit row #30.
 */
export function durationScore(mgPerServing: number, fatId: string): number {
  const base: Record<string, number> = {
    mct: 5,
    ghee: 9,
    coconut: 8.5,
    custom: 6,
  }
  const b = base[fatId] ?? 6
  if (!Number.isFinite(mgPerServing) || mgPerServing <= 0) return b
  const bonus = Math.min(4, mgPerServing / 50)
  return Math.min(10, b + bonus)
}

/**
 * Body load score.
 * Driven primarily by THC dose; CBD adds a small physical-relaxation component.
 *
 * TODO(citation): the 0.5 CBD contribution factor and 0.9 / 0.2 thc/cbd
 * weighting are engineering heuristics; no peer-reviewed source.
 * See research/academic-references.md audit row #32.
 */
export function bodyLoadScore(
  mgPerServing: number,
  cbdMgPerServing: number
): number {
  const thc = thcDoseScore(mgPerServing)
  const cbd = Math.min(10, Math.max(0, cbdMgPerServing * 0.5))
  return Math.min(10, thc * 0.9 + cbd * 0.2)
}

/**
 * Head load score.
 * Driven by THC dose; reduced by CBD (anxiolytic).
 * Decarb method modulates terpene-driven headiness.
 *
 * TODO(citation): `methodMod` map (1.05 / 1.02 / 1.08 / 0.98 / 0.92),
 * `cbdReduction = min(3, cbdMgPerServing * 0.3)`, and the multiplication
 * structure are engineering heuristics; no peer-reviewed source.
 * See research/academic-references.md audit row #31.
 */
export function headLoadScore(
  mgPerServing: number,
  cbdMgPerServing: number,
  methodId: string
): number {
  const methodMod: Record<string, number> = {
    sv_dry: 1.05,
    sv_combined: 1.05,
    sv_fast: 1.02,
    sv_lowtemp: 1.08,
    oven_sealed: 0.98,
    oven_open: 0.92,
  }
  const mod = methodMod[methodId] ?? 1.0
  const thc = thcDoseScore(mgPerServing)
  const cbdReduction = Math.min(3, cbdMgPerServing * 0.3)
  return Math.max(0, Math.min(10, thc * mod - cbdReduction))
}

/* ------------------------------------------------------------------ */
/* Composite score calculator                                         */
/* ------------------------------------------------------------------ */

export function computeRadarScores(params: {
  mgPerServing: number
  cbdaPct: number
  cbdPct: number
  weight: number
  fatId: string
  customEfficiency: string | null
  methodId: string
  servings: number
}): RadarScores {
  const {
    mgPerServing,
    cbdaPct,
    cbdPct,
    weight,
    fatId,
    customEfficiency,
    methodId,
    servings,
  } = params

  const fat = INFUSION_FATS.find(f => f.id === fatId)
  const extractionEff = customEfficiency
    ? parseFloat(customEfficiency)
    : (fat?.extractionEff ?? 0.82)

  const thcDose = thcDoseScore(mgPerServing)
  const cbdDose = cbdDoseScore(weight, cbdaPct, cbdPct, extractionEff, servings)

  // Estimate CBD mg/serving for body/head load calculations
  // 0.877 MW ratio per Filer 2022 (#1, see research/academic-references.md).
  const cbdTheoreticalMax =
    weight > 0 && servings > 0
      ? weight * ((cbdaPct / 100) * 0.877 + cbdPct / 100) * 1000
      : 0
  const cbdMgPerServing =
    weight > 0 && servings > 0
      ? (cbdTheoreticalMax * extractionEff) / servings
      : 0

  const onsetSpeed = onsetSpeedScore(mgPerServing, fatId)
  const duration = durationScore(mgPerServing, fatId)
  const bodyLoad = bodyLoadScore(mgPerServing, cbdMgPerServing)
  const headLoad = headLoadScore(mgPerServing, cbdMgPerServing, methodId)

  return {
    thcDose,
    cbdDose,
    onsetSpeed,
    duration,
    bodyLoad,
    headLoad,
  }
}

/* ------------------------------------------------------------------ */
/* Geometry                                                           */
/* ------------------------------------------------------------------ */

export const RADAR_AXES = [
  { key: 'thcDose', label: 'THC Dose' },
  { key: 'cbdDose', label: 'CBD Dose' },
  { key: 'onsetSpeed', label: 'Onset Speed' },
  { key: 'duration', label: 'Duration' },
  { key: 'bodyLoad', label: 'Body Load' },
  { key: 'headLoad', label: 'Head Load' },
] as const

/**
 * Compute radar chart vertex coordinates from scores.
 * Angles start at -90° (top) and proceed clockwise.
 */
export function radarPoints(
  scores: number[],
  centerX: number,
  centerY: number,
  radius: number
): RadarPoint[] {
  const count = scores.length
  return scores.map((score, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2
    const r = (Math.min(10, Math.max(0, score)) / 10) * radius
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    }
  })
}

/**
 * Compute ring radii from score value labels.
 * Labels are parsed as numbers and scaled proportionally to radius.
 */
export function ringRadii(
  labels: string[],
  maxScore: number,
  radius: number
): number[] {
  return labels.map(label => {
    const value = parseFloat(label)
    if (!Number.isFinite(value)) return 0
    return (Math.max(0, Math.min(maxScore, value)) / maxScore) * radius
  })
}

/**
 * Build a closed SVG path `d` string from points.
 */
export function polygonPath(points: RadarPoint[]): string {
  if (points.length === 0) return ''
  const start = points[0]
  let d = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`
  }
  d += ' Z'
  return d
}

/**
 * Compute label position at the outer end of an axis spoke.
 */
export function axisLabelPosition(
  index: number,
  total: number,
  centerX: number,
  centerY: number,
  radius: number,
  padding: number
): RadarPoint {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2
  return {
    x: centerX + (radius + padding) * Math.cos(angle),
    y: centerY + (radius + padding) * Math.sin(angle),
  }
}
