/**
 * Tests for the wizard branch sequences + smart-skip helper.
 *
 * Per the architecture doc §3.1, the 5 branches have these
 * canonical step sequences:
 *  - flower:      Method → Container → Weight → Efficiency →
 *                 Fat → Volume → Start
 *  - concentrate: Potency → Carrier → Volume → Servings → Start
 *  - avb:         Color → Carrier → Volume → Servings → Start
 *  - edible:      Method → Container → Weight → Fat → Volume →
 *                 Servings → Start
 *  - topical:     Carrier → Volume → ApplicationArea → Start
 *
 * The canonical sequence is the unfiltered list. Smart-skip
 * (via `getEffectiveBranchSequence`) filters out steps whose
 * `skipIf(state)` returns true:
 *  - Volume is skipped for the Flower "no infusion" path.
 *  - Servings is skipped for the Topical branch.
 *
 * Coverage:
 *  - Each branch's canonical sequence has the right steps in
 *    the right order.
 *  - `getEffectiveBranchSequence` applies smart-skip and
 *    returns the right filtered sequence.
 */
import { describe, expect, it } from 'vitest'
import {
  BRANCH_SEQUENCES,
  getBranchSequence,
  getEffectiveBranchSequence,
} from '../branchSequences'
import type { WizardState } from '../wizardTypes'

const emptyState = (branch: WizardState['branch']): WizardState => ({
  branch,
  currentStep: 0,
  selections: {},
})

describe('BRANCH_SEQUENCES — canonical ordering', () => {
  it('flower: productType → method → container → weight → efficiency → fat → volume → start', () => {
    const ids = BRANCH_SEQUENCES.flower.map(s => s.id)
    expect(ids).toEqual([
      'product-type',
      'method',
      'container',
      'weight',
      'efficiency',
      'fat',
      'volume',
      'start',
    ])
  })

  it('concentrate: productType → potency → carrier → volume → servings → start', () => {
    const ids = BRANCH_SEQUENCES.concentrate.map(s => s.id)
    expect(ids).toEqual([
      'product-type',
      'potency',
      'carrier',
      'volume',
      'servings',
      'start',
    ])
  })

  it('avb: productType → color → carrier → volume → servings → start', () => {
    const ids = BRANCH_SEQUENCES.avb.map(s => s.id)
    expect(ids).toEqual([
      'product-type',
      'color',
      'carrier',
      'volume',
      'servings',
      'start',
    ])
  })

  it('edible: productType → method → container → weight → fat → volume → servings → start', () => {
    const ids = BRANCH_SEQUENCES.edible.map(s => s.id)
    expect(ids).toEqual([
      'product-type',
      'method',
      'container',
      'weight',
      'fat',
      'volume',
      'servings',
      'start',
    ])
  })

  it('topical: productType → carrier → volume → applicationArea → start', () => {
    const ids = BRANCH_SEQUENCES.topical.map(s => s.id)
    expect(ids).toEqual([
      'product-type',
      'carrier',
      'volume',
      'applicationArea',
      'start',
    ])
  })

  it('the Concentrate / AVB / Topical branches do NOT include the Method step', () => {
    expect(
      BRANCH_SEQUENCES.concentrate.find(s => s.id === 'method')
    ).toBeUndefined()
    expect(BRANCH_SEQUENCES.avb.find(s => s.id === 'method')).toBeUndefined()
    expect(
      BRANCH_SEQUENCES.topical.find(s => s.id === 'method')
    ).toBeUndefined()
  })
})

describe('getBranchSequence (canonical, no smart-skip)', () => {
  it('returns null when the branch is null', () => {
    expect(getBranchSequence(null)).toBeNull()
  })

  it('returns the canonical sequence for each branch', () => {
    expect(getBranchSequence('flower')?.map(s => s.id)).toEqual([
      'product-type',
      'method',
      'container',
      'weight',
      'efficiency',
      'fat',
      'volume',
      'start',
    ])
    expect(getBranchSequence('concentrate')?.map(s => s.id)).toEqual([
      'product-type',
      'potency',
      'carrier',
      'volume',
      'servings',
      'start',
    ])
  })
})

describe('getEffectiveBranchSequence — smart-skip', () => {
  it('returns [productTypeStep] when the branch is null', () => {
    const result = getEffectiveBranchSequence(null, emptyState(null))
    expect(result?.map(s => s.id)).toEqual(['product-type'])
  })

  it('returns the canonical sequence when no smart-skip applies', () => {
    const state = emptyState('concentrate')
    const result = getEffectiveBranchSequence('concentrate', state)
    expect(result?.map(s => s.id)).toEqual([
      'product-type',
      'potency',
      'carrier',
      'volume',
      'servings',
      'start',
    ])
  })

  it('skips Volume in the Flower "no infusion" path', () => {
    // selections.fat === null is the brief-mandated sentinel.
    const state: WizardState = {
      branch: 'flower',
      currentStep: 5,
      selections: { fat: null },
    }
    const result = getEffectiveBranchSequence('flower', state)
    const ids = result?.map(s => s.id)
    expect(ids).toContain('fat')
    expect(ids).not.toContain('volume')
  })

  it('keeps Volume in the Flower "with infusion" path', () => {
    const state: WizardState = {
      branch: 'flower',
      currentStep: 5,
      selections: { fat: 'coconut' },
    }
    const result = getEffectiveBranchSequence('flower', state)
    const ids = result?.map(s => s.id)
    expect(ids).toContain('fat')
    expect(ids).toContain('volume')
  })

  it('skips Servings in the Topical branch', () => {
    const state = emptyState('topical')
    const result = getEffectiveBranchSequence('topical', state)
    const ids = result?.map(s => s.id)
    expect(ids).not.toContain('servings')
    expect(ids).toContain('applicationArea')
  })

  it('keeps Servings for the Concentrate / AVB / Edible branches (Flower has no Servings step in its canonical sequence)', () => {
    for (const branch of ['concentrate', 'avb', 'edible'] as const) {
      const result = getEffectiveBranchSequence(branch, emptyState(branch))
      const ids = result?.map(s => s.id) ?? []
      expect(ids).toContain('servings')
    }
    // The Flower branch's canonical sequence ends at Volume →
    // Start (the user doses decarbed flower directly, not
    // per-piece). The Flower branch does not have a Servings
    // step at all.
    const flower = getEffectiveBranchSequence('flower', emptyState('flower'))
    expect(flower?.map(s => s.id)).not.toContain('servings')
  })
})
