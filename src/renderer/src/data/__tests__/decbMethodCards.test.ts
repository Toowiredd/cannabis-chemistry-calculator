/**
 * decbMethodCards.ts data tests (Week 6, §8.6).
 *
 * FirstTimerGuide's per-method content extracted to
 * `src/renderer/src/data/decbMethodCards.ts` so the new Wizard's
 * per-step explanations (when the user asks "what does this
 * method mean?") can render a tooltip. This test pins the shape
 * contract.
 *
 * Coverage:
 *  - 6 entries (the 6 real decarb methods in the engine)
 *  - Every entry has a non-empty `label` + `humanNote`
 *  - Every id matches a real `PresetMethod.id` from
 *    `engine/models.ts`
 *  - Every entry carries the wizard-side decoration fields
 *    (`badge` + `tooltip`) the brief asked for
 *  - `findDecbMethodCard(id)` round-trips by id
 */
import { describe, expect, it } from 'vitest'

import { DECB_METHOD_CARDS, findDecbMethodCard } from '../decbMethodCards'
import { DECARB_METHODS } from '../../engine/models'

/* ------------------------------------------------------------------ */
/* Constants — engine preset id set for the cross-check               */
/* ------------------------------------------------------------------ */

const VALID_METHOD_IDS = new Set(DECARB_METHODS.map(m => m.id))

/* ------------------------------------------------------------------ */
/* Shape contract                                                      */
/* ------------------------------------------------------------------ */

describe('DECB_METHOD_CARDS — shape contract (Week 6, §8.6)', () => {
  it('has 6 entries (the 6 real decarb methods)', () => {
    expect(DECB_METHOD_CARDS).toHaveLength(6)
  })

  it('every entry has a non-empty label + humanNote', () => {
    for (const card of DECB_METHOD_CARDS) {
      expect(typeof card.label).toBe('string')
      expect(card.label.length).toBeGreaterThan(0)
      expect(typeof card.humanNote).toBe('string')
      expect(card.humanNote.length).toBeGreaterThan(0)
    }
  })

  it('every entry has a badge (the brief-mandated wizard decoration)', () => {
    for (const card of DECB_METHOD_CARDS) {
      expect(card.badge).toBeDefined()
      expect(typeof card.badge).toBe('string')
      expect(card.badge?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('every entry has a tooltip (the brief-mandated wizard decoration)', () => {
    for (const card of DECB_METHOD_CARDS) {
      expect(card.tooltip).toBeDefined()
      expect(typeof card.tooltip).toBe('string')
      expect(card.tooltip?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('every id is a real PresetMethod.id (no fabricated ids)', () => {
    for (const card of DECB_METHOD_CARDS) {
      expect(VALID_METHOD_IDS.has(card.id)).toBe(true)
    }
  })

  it('every id is unique (no duplicate cards on the wizard)', () => {
    const ids = DECB_METHOD_CARDS.map(c => c.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

/* ------------------------------------------------------------------ */
/* Engine data pass-through — temperatures, times, efficiencies       */
/* ------------------------------------------------------------------ */

describe('DECB_METHOD_CARDS — engine data pass-through', () => {
  it('the temp/time/efficiency fields match the engine DECARB_METHODS', () => {
    // The card data is a re-export of the engine's
    // DECARB_METHOD_CARDS plus the badge/tooltip decorations —
    // the engine values must round-trip exactly. A divergence
    // here would mean the data file is shadowing the engine
    // values, which is the bug Week 1's data-derivation work
    // explicitly avoided.
    for (const card of DECB_METHOD_CARDS) {
      const source = DECARB_METHODS.find(m => m.id === card.id)
      expect(source).toBeDefined()
      expect(card.tempC).toBe(source?.tempC)
      expect(card.timeMin).toBe(source?.timeMin)
      expect(card.timeMax).toBe(source?.timeMax)
      expect(card.efficiency).toEqual(source?.efficiency)
    }
  })
})

/* ------------------------------------------------------------------ */
/* findDecbMethodCard lookup                                           */
/* ------------------------------------------------------------------ */

describe('findDecbMethodCard — id lookup', () => {
  it('returns the matching card for a known id', () => {
    const card = findDecbMethodCard('oven_sealed')
    expect(card?.label.length).toBeGreaterThan(0)
    expect(card?.tempC).toBeGreaterThan(0)
  })

  it('returns null for an unknown id', () => {
    const card = findDecbMethodCard('not-a-real-method')
    expect(card).toBeNull()
  })

  it('returns null for an empty id', () => {
    const card = findDecbMethodCard('')
    expect(card).toBeNull()
  })
})
