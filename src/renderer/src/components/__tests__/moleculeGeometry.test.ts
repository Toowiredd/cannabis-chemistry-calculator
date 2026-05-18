import { describe, it, expect } from 'vitest'
import {
  getPhaseName,
  getPhaseIndex,
  clamp,
  easeOutCubic,
  easeInOutCubic,
  lerp,
  interpolateColor,
  computeTransforms,
  hexPoints,
  pointsToStr,
  COLOR_THCA,
  COLOR_THC,
} from '../moleculeGeometry'

describe('moleculeGeometry', () => {
  describe('clamp', () => {
    it('clamps value between min and max', () => {
      expect(clamp(-1)).toBe(0)
      expect(clamp(1.5)).toBe(1)
      expect(clamp(0.5)).toBe(0.5)
    })
  })

  describe('easeOutCubic', () => {
    it('returns 0 at t=0 and 1 at t=1', () => {
      expect(easeOutCubic(0)).toBe(0)
      expect(easeOutCubic(1)).toBe(1)
    })
    it('produces an eased value between 0 and 1', () => {
      expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 3)
    })
  })

  describe('easeInOutCubic', () => {
    it('returns 0 at t=0 and 1 at t=1', () => {
      expect(easeInOutCubic(0)).toBe(0)
      expect(easeInOutCubic(1)).toBe(1)
    })
    it('is correct at midpoint', () => {
      expect(easeInOutCubic(0.25)).toBeCloseTo(0.0625, 3)
      expect(easeInOutCubic(0.75)).toBeCloseTo(0.9375, 3)
      // Point symmetry about (0.5, 0.5)
      expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1, 3)
      expect(easeInOutCubic(0.5)).toBe(0.5)
    })
  })

  describe('lerp', () => {
    it('interpolates between two values', () => {
      expect(lerp(0, 100, 0.5)).toBe(50)
      expect(lerp(10, 20, 0)).toBe(10)
      expect(lerp(10, 20, 1)).toBe(20)
    })
  })

  describe('interpolateColor', () => {
    it('returns start color at t=0 and end color at t=1', () => {
      expect(interpolateColor('#000000', '#ffffff', 0)).toBe('#000000')
      expect(interpolateColor('#000000', '#ffffff', 1)).toBe('#ffffff')
    })
    it('produces a midpoint color', () => {
      expect(interpolateColor('#000000', '#ffffff', 0.5)).toBe('#808080')
    })
  })

  describe('hexPoints', () => {
    it('generates 6 points for a hexagon', () => {
      const pts = hexPoints(0, 0, 10)
      expect(pts).toHaveLength(6)
      pts.forEach(pt => {
        expect(Number.isFinite(pt.x)).toBe(true)
        expect(Number.isFinite(pt.y)).toBe(true)
      })
    })
  })

  describe('pointsToStr', () => {
    it('formats points as SVG-compatible string', () => {
      const s = pointsToStr([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ])
      expect(s).toContain('1.00,2.00')
      expect(s).toContain('3.00,4.00')
    })
  })

  describe('getPhaseName', () => {
    it('returns correct phase names for sample progress values', () => {
      expect(getPhaseName(0)).toBe('fadeIn')
      expect(getPhaseName(0.15)).toBe('carboxylPulse')
      expect(getPhaseName(0.3)).toBe('vibration')
      expect(getPhaseName(0.4)).toBe('detachment')
      expect(getPhaseName(0.55)).toBe('rearrangement')
      expect(getPhaseName(0.7)).toBe('co2Float')
      expect(getPhaseName(0.8)).toBe('thcLabel')
      expect(getPhaseName(0.9)).toBe('caption')
      expect(getPhaseName(1)).toBe('completed')
    })
  })

  describe('getPhaseIndex', () => {
    it('returns correct phase indices', () => {
      expect(getPhaseIndex(0)).toBe(0)
      expect(getPhaseIndex(0.15)).toBe(1)
      expect(getPhaseIndex(0.3)).toBe(2)
      expect(getPhaseIndex(0.4)).toBe(3)
      expect(getPhaseIndex(0.55)).toBe(4)
      expect(getPhaseIndex(0.7)).toBe(5)
      expect(getPhaseIndex(0.8)).toBe(6)
      expect(getPhaseIndex(0.9)).toBe(7)
      expect(getPhaseIndex(1)).toBe(8)
    })
  })

  describe('computeTransforms', () => {
    it('returns initial state at progress 0', () => {
      const t = computeTransforms(0)
      expect(t.moleculeOpacity).toBeCloseTo(1)
      expect(t.bondOpacity).toBe(1)
      expect(t.carboxylOpacity).toBe(1)
      expect(t.co2LabelOpacity).toBe(0)
      expect(t.thcLabelOpacity).toBe(0)
      expect(t.captionOpacity).toBe(0)
      expect(t.ringColor).toBe(COLOR_THCA)
      expect(t.vibrationOffset.x).toBe(0)
    })

    it('returns full labels at progress 1', () => {
      const t = computeTransforms(1)
      expect(t.moleculeOpacity).toBe(1)
      expect(t.bondOpacity).toBe(0)
      expect(t.co2LabelOpacity).toBe(1)
      expect(t.thcLabelOpacity).toBe(1)
      expect(t.captionOpacity).toBe(1)
      expect(t.ringColor).toBe(COLOR_THC)
    })

    it('shows vibration at 30%', () => {
      const t = computeTransforms(0.3)
      expect(t.vibrationOffset.x).not.toBe(0)
      expect(t.glowIntensity).toBeGreaterThan(0)
    })

    it('shows carboxyl detached at 45%', () => {
      const t = computeTransforms(0.45)
      expect(t.carboxylTranslate.y).toBeLessThan(-20)
      expect(t.bondOpacity).toBeLessThan(0.5)
    })

    it('shows ring rearrangement at 55%', () => {
      const t = computeTransforms(0.55)
      expect(t.ring1Translate.x).not.toBe(0)
      expect(t.ringColor).not.toBe(COLOR_THCA)
      expect(t.ringColor).not.toBe(COLOR_THC)
    })

    it('shows CO2 label at 70%', () => {
      const t = computeTransforms(0.7)
      expect(t.co2LabelOpacity).toBeGreaterThan(0)
    })

    it('shows THC label at 80%', () => {
      const t = computeTransforms(0.8)
      expect(t.thcLabelOpacity).toBeGreaterThan(0)
      expect(t.captionOpacity).toBe(0)
    })

    it('caption appears at 90%', () => {
      const t = computeTransforms(0.9)
      expect(t.captionOpacity).toBeGreaterThan(0)
    })

    it('shows THCA label at 60%', () => {
      const t = computeTransforms(0.6)
      expect(t.thcaLabelOpacity).toBeGreaterThan(0)
    })

    it('THCA label fades gradually between 62.5% and 75%', () => {
      const t65 = computeTransforms(0.65)
      const t70 = computeTransforms(0.7)
      const t75 = computeTransforms(0.75)
      expect(t65.thcaLabelOpacity).toBeGreaterThan(t70.thcaLabelOpacity)
      expect(t70.thcaLabelOpacity).toBeGreaterThan(t75.thcaLabelOpacity)
      expect(t75.thcaLabelOpacity).toBe(0)
    })

    it('carboxyl floats upward during detachment', () => {
      const t25 = computeTransforms(0.375)
      const t50 = computeTransforms(0.5)
      expect(t50.carboxylTranslate.y).toBeLessThan(t25.carboxylTranslate.y)
    })

    it('has no vibration after detachment completes', () => {
      const t = computeTransforms(0.6)
      expect(Math.abs(t.vibrationOffset.x)).toBeLessThan(0.1)
    })
  })
})
