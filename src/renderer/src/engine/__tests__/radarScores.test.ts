import { describe, expect, it } from 'vitest'
import {
  axisLabelPosition,
  bodyLoadScore,
  cbdDoseScore,
  computeRadarScores,
  durationScore,
  headLoadScore,
  onsetSpeedScore,
  piecewiseScore,
  polygonPath,
  radarPoints,
  thcDoseScore,
} from '../radarScores'

describe('piecewiseScore', () => {
  it('returns first anchor when value is below range', () => {
    expect(
      piecewiseScore(-5, [
        [0, 0],
        [10, 10],
      ])
    ).toBe(0)
  })

  it('returns last anchor when value is above range', () => {
    expect(
      piecewiseScore(15, [
        [0, 0],
        [10, 10],
      ])
    ).toBe(10)
  })

  it('interpolates between two anchors', () => {
    expect(
      piecewiseScore(5, [
        [0, 0],
        [10, 10],
      ])
    ).toBe(5)
  })

  it('interpolates with three anchors', () => {
    expect(
      piecewiseScore(15, [
        [0, 0],
        [10, 5],
        [20, 10],
      ])
    ).toBe(7.5)
  })
})

describe('thcDoseScore', () => {
  it('0 mg → 0', () => {
    expect(thcDoseScore(0)).toBe(0)
  })

  it('2.5 mg → 2', () => {
    expect(thcDoseScore(2.5)).toBe(2)
  })

  it('10 mg → 4', () => {
    expect(thcDoseScore(10)).toBe(4)
  })

  it('25 mg → 6', () => {
    expect(thcDoseScore(25)).toBe(6)
  })

  it('100 mg → 10', () => {
    expect(thcDoseScore(100)).toBe(10)
  })

  it('200 mg → 10 (clamped)', () => {
    expect(thcDoseScore(200)).toBe(10)
  })
})

describe('cbdDoseScore', () => {
  it('returns 0 when weight is 0', () => {
    expect(cbdDoseScore(0, 10, 0, 0.85, 10)).toBe(0)
  })

  it('returns 0 when servings is 0', () => {
    expect(cbdDoseScore(3.5, 10, 0, 0.85, 0)).toBe(0)
  })

  it('calculates for typical 3.5g flower with 2% CBDA', () => {
    // 3.5 * (0.02*0.877 + 0) * 1000 = 61.39 mg total CBD
    // * 0.85 eff = 52.18 mg
    // / 10 servings = 5.218 mg/serving → score 5.218
    const score = cbdDoseScore(3.5, 2, 0, 0.85, 10)
    expect(score).toBeGreaterThan(5)
    expect(score).toBeLessThan(6)
  })

  it('caps at 10 for very high CBD', () => {
    expect(cbdDoseScore(10, 20, 2, 0.92, 2)).toBe(10)
  })
})

describe('onsetSpeedScore', () => {
  it('MCT base is 9 for low dose', () => {
    expect(onsetSpeedScore(5, 'mct')).toBeGreaterThan(8)
  })

  it('ghee base is 7 for low dose', () => {
    expect(onsetSpeedScore(5, 'ghee')).toBeGreaterThan(6)
  })

  it('penalized for high dose', () => {
    expect(onsetSpeedScore(100, 'mct')).toBeLessThan(6)
  })

  it('never drops below 1', () => {
    expect(onsetSpeedScore(500, 'custom')).toBe(1)
  })
})

describe('durationScore', () => {
  it('ghee gives highest base', () => {
    expect(durationScore(5, 'ghee')).toBeGreaterThan(8)
  })

  it('bonus from high dose', () => {
    expect(durationScore(100, 'ghee')).toBe(10)
  })

  it('MCT gets modest base', () => {
    expect(durationScore(5, 'mct')).toBeGreaterThan(4)
    expect(durationScore(5, 'mct')).toBeLessThan(6)
  })
})

describe('bodyLoadScore', () => {
  it('scales with THC dose', () => {
    expect(bodyLoadScore(25, 0)).toBeGreaterThan(bodyLoadScore(5, 0))
  })

  it('slightly boosted by CBD', () => {
    expect(bodyLoadScore(10, 5)).toBeGreaterThan(bodyLoadScore(10, 0))
  })
})

describe('headLoadScore', () => {
  it('scales with THC dose', () => {
    expect(headLoadScore(50, 0, 'sv_dry')).toBeGreaterThan(
      headLoadScore(5, 0, 'sv_dry')
    )
  })

  it('reduced by CBD', () => {
    expect(headLoadScore(25, 10, 'sv_dry')).toBeLessThan(
      headLoadScore(25, 0, 'sv_dry')
    )
  })

  it('sous vide low temp boosts headiness', () => {
    expect(headLoadScore(25, 0, 'sv_lowtemp')).toBeGreaterThan(
      headLoadScore(25, 0, 'oven_open')
    )
  })
})

describe('computeRadarScores', () => {
  it('produces all values in 0–10 range for moderate dose', () => {
    const scores = computeRadarScores({
      mgPerServing: 15,
      cbdaPct: 0,
      cbdPct: 0,
      weight: 3.5,
      fatId: 'coconut',
      customEfficiency: null,
      methodId: 'oven_sealed',
      servings: 10,
    })
    expect(scores.thcDose).toBeGreaterThan(0)
    expect(scores.thcDose).toBeLessThanOrEqual(10)
    expect(scores.cbdDose).toBe(0)
    expect(scores.onsetSpeed).toBeGreaterThan(0)
    expect(scores.duration).toBeGreaterThan(0)
    expect(scores.bodyLoad).toBeGreaterThan(0)
    expect(scores.headLoad).toBeGreaterThan(0)
  })

  it('microdose produces low scores', () => {
    const scores = computeRadarScores({
      mgPerServing: 2.5,
      cbdaPct: 0,
      cbdPct: 0,
      weight: 3.5,
      fatId: 'coconut',
      customEfficiency: null,
      methodId: 'oven_sealed',
      servings: 10,
    })
    expect(scores.thcDose).toBeLessThanOrEqual(2)
    expect(scores.bodyLoad).toBeLessThanOrEqual(2)
    expect(scores.headLoad).toBeLessThanOrEqual(2)
  })

  it('extreme dose produces high scores', () => {
    const scores = computeRadarScores({
      mgPerServing: 125,
      cbdaPct: 0,
      cbdPct: 0,
      weight: 3.5,
      fatId: 'coconut',
      customEfficiency: null,
      methodId: 'oven_sealed',
      servings: 10,
    })
    expect(scores.thcDose).toBe(10)
    expect(scores.bodyLoad).toBeGreaterThan(7)
    expect(scores.headLoad).toBeGreaterThan(7)
  })

  it('custom fat uses custom efficiency', () => {
    const scores = computeRadarScores({
      mgPerServing: 10,
      cbdaPct: 2,
      cbdPct: 0,
      weight: 3.5,
      fatId: 'custom',
      customEfficiency: '0.5',
      methodId: 'oven_sealed',
      servings: 10,
    })
    expect(scores.cbdDose).toBeGreaterThan(0)
  })
})

describe('radarPoints', () => {
  it('all zeros → all points at center', () => {
    const pts = radarPoints([0, 0, 0, 0, 0, 0], 100, 100, 80)
    for (const p of pts) {
      expect(p.x).toBeCloseTo(100, 5)
      expect(p.y).toBeCloseTo(100, 5)
    }
  })

  it('all tens → all points on outer ring', () => {
    const pts = radarPoints([10, 10, 10, 10, 10, 10], 100, 100, 80)
    for (let i = 0; i < pts.length; i++) {
      const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2
      const expectedX = 100 + 80 * Math.cos(angle)
      const expectedY = 100 + 80 * Math.sin(angle)
      expect(pts[i].x).toBeCloseTo(expectedX, 5)
      expect(pts[i].y).toBeCloseTo(expectedY, 5)
    }
  })

  it('single non-zero score positions correctly', () => {
    const pts = radarPoints([10, 0, 0, 0, 0, 0], 100, 100, 80)
    expect(pts[0].x).toBeCloseTo(100, 5)
    expect(pts[0].y).toBeCloseTo(20, 5) // top
  })

  it('handles non-6 count gracefully', () => {
    const pts = radarPoints([5, 5, 5], 100, 100, 80)
    expect(pts.length).toBe(3)
  })
})

describe('polygonPath', () => {
  it('returns empty string for empty points', () => {
    expect(polygonPath([])).toBe('')
  })

  it('returns a closed path for square', () => {
    const path = polygonPath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ])
    expect(path).toMatch(/^M\s/)
    expect(path).toMatch(/Z$/)
  })
})

describe('axisLabelPosition', () => {
  it('first axis at top', () => {
    const pos = axisLabelPosition(0, 6, 100, 100, 80, 12)
    expect(pos.x).toBeCloseTo(100, 5)
    expect(pos.y).toBeCloseTo(100 - 80 - 12, 5)
  })

  it('third axis at bottom', () => {
    const pos = axisLabelPosition(3, 6, 100, 100, 80, 12)
    expect(pos.x).toBeCloseTo(100, 5)
    expect(pos.y).toBeCloseTo(100 + 80 + 12, 5)
  })
})
