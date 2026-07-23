import { describe, it, expect } from 'vitest'
import {
  gToOz,
  ozToG,
  cToF,
  fToC,
  mlToTsp,
  tspToMl,
  mlToTbsp,
  tbspToMl,
  mlToCup,
  cupToMl,
  volumeToMl,
  round1,
} from '../units'

describe('units', () => {
  describe('round1', () => {
    it('rounds to max 1 decimal', () => {
      expect(round1(28.3495)).toBe(28.3)
      expect(round1(28.35)).toBe(28.4)
      expect(round1(0)).toBe(0)
      expect(round1(1.999)).toBe(2.0)
    })
  })

  describe('gToOz', () => {
    it('converts 28.3495g to 1.0 oz', () => {
      expect(gToOz(28.3495)).toBe(1.0)
    })

    it('converts 1.0 oz to 28.35g then back to 1.0 oz', () => {
      const g = ozToG(1.0)
      expect(gToOz(g)).toBe(1.0)
    })

    it('handles zero', () => {
      expect(gToOz(0)).toBe(0)
    })

    it('handles large values', () => {
      expect(gToOz(2834.95)).toBe(100.0)
    })
  })

  describe('ozToG', () => {
    it('converts 1.0 oz to 28.35g', () => {
      expect(ozToG(1.0)).toBeCloseTo(28.35, 2)
    })

    it('converts 28.3495g to 1.0 oz then back to 28.35g', () => {
      const oz = gToOz(28.3495)
      expect(ozToG(oz)).toBeCloseTo(28.35, 2)
    })

    it('handles zero', () => {
      expect(ozToG(0)).toBe(0)
    })
  })

  describe('cToF', () => {
    it('converts 100C to 212F', () => {
      expect(cToF(100)).toBe(212)
    })

    it('converts 0C to 32F', () => {
      expect(cToF(0)).toBe(32)
    })

    it('converts -40C to -40F', () => {
      expect(cToF(-40)).toBe(-40)
    })
  })

  describe('fToC', () => {
    it('converts 212F to 100C', () => {
      expect(fToC(212)).toBe(100)
    })

    it('converts 32F to 0C', () => {
      expect(fToC(32)).toBe(0)
    })

    it('converts -40F to -40C', () => {
      expect(fToC(-40)).toBe(-40)
    })
  })

  describe('C↔F reversibility', () => {
    it('is reversible with no cumulative drift for 100C', () => {
      let c = 100
      for (let i = 0; i < 10; i++) {
        const f = cToF(c)
        c = fToC(f)
      }
      expect(c).toBe(100)
    })

    it('is reversible with no cumulative drift for 0C', () => {
      let c = 0
      for (let i = 0; i < 10; i++) {
        const f = cToF(c)
        c = fToC(f)
      }
      expect(c).toBe(0)
    })

    it('is reversible with no cumulative drift for 95C', () => {
      let c = 95
      for (let i = 0; i < 10; i++) {
        const f = cToF(c)
        c = fToC(f)
      }
      expect(c).toBe(95)
    })
  })

  describe('mlToTsp', () => {
    it('converts 30mL to ~6.1 tsp', () => {
      expect(mlToTsp(30)).toBeCloseTo(6.1, 1)
    })

    it('handles zero', () => {
      expect(mlToTsp(0)).toBe(0)
    })

    it('converts 4.929mL to 1.0 tsp', () => {
      expect(mlToTsp(4.929)).toBe(1.0)
    })
  })

  describe('tspToMl', () => {
    it('converts 1.0 tsp to 4.929mL', () => {
      expect(tspToMl(1)).toBe(4.929)
    })

    it('converts ~6.086 tsp back to ~30mL', () => {
      const ml = tspToMl(6.086)
      expect(ml).toBeCloseTo(30.0, 1)
    })
  })

  describe('mlToTbsp', () => {
    it('converts 30mL to ~2.0 tbsp', () => {
      expect(mlToTbsp(30)).toBeCloseTo(2.0, 1)
    })

    it('handles zero', () => {
      expect(mlToTbsp(0)).toBe(0)
    })
  })

  describe('tbspToMl', () => {
    it('converts 1 tbsp to 14.787mL', () => {
      expect(tbspToMl(1)).toBe(14.787)
    })
  })

  describe('mlToCup', () => {
    it('converts 240mL to ~1.0 cup', () => {
      expect(mlToCup(240)).toBeCloseTo(1.0, 1)
    })

    it('handles zero', () => {
      expect(mlToCup(0)).toBe(0)
    })
  })

  describe('cupToMl', () => {
    it('converts 1 cup to 236.588mL', () => {
      expect(cupToMl(1)).toBe(236.588)
    })
  })

  describe('volumeToMl', () => {
    it('passes mL through unchanged', () => {
      expect(volumeToMl(120, 'mL')).toBe(120)
    })
    it('converts tsp via tspToMl', () => {
      expect(volumeToMl(2, 'tsp')).toBeCloseTo(2 * 4.929, 6)
    })
    it('converts tbsp via tbspToMl', () => {
      expect(volumeToMl(1, 'tbsp')).toBe(14.787)
    })
    it('converts cup via cupToMl', () => {
      expect(volumeToMl(0.5, 'cup')).toBeCloseTo(118.294, 3)
    })
    it('throws on unknown unit (exhaustiveness check)', () => {
      expect(() =>
        volumeToMl(1, 'unknown' as unknown as 'mL')
      ).toThrow(/Unknown volume unit/)
    })
  })
})
