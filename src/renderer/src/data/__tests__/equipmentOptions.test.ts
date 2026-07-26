/**
 * equipmentOptions.ts data tests (Week 6, §8.6).
 *
 * FirstTimerGuide's `EQUIPMENT_OPTIONS` array extracted to
 * `src/renderer/src/data/equipmentOptions.ts` so the new
 * Wizard's per-step explanations can reuse the data. This test
 * pins the shape contract so a future change to the data file
 * can't silently regress the FirstTimerGuide's equipment step.
 *
 * Coverage:
 *  - At least 10 entries (the brief enumerated 10 core items;
 *    the source actually has 13 because the 3 extra items
 *    `strainer`, `bake_vehicle`, `kitchen_scale` were preserved
 *    from FirstTimerGuide's full list — see the data file
 *    JSDoc for the rationale)
 *  - Every entry has a non-empty `label` + `subtitle` + a
 *    defined `Icon` component
 *  - The 10 brief-enumerated ids are all present
 *  - `findEquipmentOption(id)` round-trips by id and returns
 *    `null` for unknown ids
 */
import { describe, expect, it } from 'vitest'

import { EQUIPMENT_OPTIONS, findEquipmentOption } from '../equipmentOptions'

/* ------------------------------------------------------------------ */
/* Shape contract                                                      */
/* ------------------------------------------------------------------ */

describe('EQUIPMENT_OPTIONS — shape contract (Week 6, §8.6)', () => {
  it('has at least 10 entries (the brief-enumerated floor)', () => {
    // The brief enumerated 10 items; the source actually has
    // 13 because 3 extras (strainer, bake_vehicle, kitchen_scale)
    // were preserved from FirstTimerGuide. We assert the floor
    // so a future regression that drops a core id fails, while
    // still allowing the 3 extras to stay.
    expect(EQUIPMENT_OPTIONS.length).toBeGreaterThanOrEqual(10)
  })

  it('every entry has a non-empty label + subtitle', () => {
    for (const opt of EQUIPMENT_OPTIONS) {
      expect(typeof opt.id).toBe('string')
      expect(opt.id.length).toBeGreaterThan(0)
      expect(typeof opt.label).toBe('string')
      expect(opt.label.length).toBeGreaterThan(0)
      expect(typeof opt.subtitle).toBe('string')
      expect(opt.subtitle.length).toBeGreaterThan(0)
    }
  })

  it('every entry has a defined Icon component', () => {
    for (const opt of EQUIPMENT_OPTIONS) {
      // lucide-react icons are forwardRef components; we just
      // assert the value is a function (component) or an
      // object (forwardRef wraps in { $$typeof, render }).
      expect(opt.Icon).toBeDefined()
      expect(['function', 'object']).toContain(typeof opt.Icon)
    }
  })

  it('every id is unique (no duplicate equipment tiles)', () => {
    const ids = EQUIPMENT_OPTIONS.map(o => o.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

/* ------------------------------------------------------------------ */
/* The 10 brief-enumerated ids                                         */
/* ------------------------------------------------------------------ */

describe('EQUIPMENT_OPTIONS — the 10 brief-enumerated ids are all present', () => {
  const BRIEF_IDS = [
    'flower',
    'glass_dish',
    'foil',
    'fat',
    'oven',
    'heat_source',
    'sv_circulator',
    'vacuum_sealer',
    'mason_jar',
    'probe_thermometer',
  ] as const

  for (const id of BRIEF_IDS) {
    it(`contains the "${id}" entry`, () => {
      const opt = EQUIPMENT_OPTIONS.find(o => o.id === id)
      expect(opt).toBeDefined()
    })
  }
})

/* ------------------------------------------------------------------ */
/* findEquipmentOption lookup                                          */
/* ------------------------------------------------------------------ */

describe('findEquipmentOption — id lookup', () => {
  it('returns the matching option for a known id', () => {
    const opt = findEquipmentOption('oven')
    expect(opt?.label).toBe('An oven')
  })

  it('returns null for an unknown id', () => {
    const opt = findEquipmentOption('not-a-real-equipment')
    expect(opt).toBeNull()
  })

  it('returns null for an empty id', () => {
    const opt = findEquipmentOption('')
    expect(opt).toBeNull()
  })
})
