import { describe, it, expect } from 'vitest'
import {
  shouldSwipeTransition,
  shouldWheelTransition,
  workflowIndex,
  clampIndex,
  WORKFLOW_TABS,
} from '../SwipeDeck'

describe('SwipeDeck gesture logic', () => {
  describe('shouldSwipeTransition', () => {
    it('returns left for strong horizontal swipe left', () => {
      expect(shouldSwipeTransition(-100, 10)).toBe('left')
    })

    it('returns right for strong horizontal swipe right', () => {
      expect(shouldSwipeTransition(100, 10)).toBe('right')
    })

    it('returns null when delta is below threshold', () => {
      expect(shouldSwipeTransition(-50, 10)).toBe(null)
      expect(shouldSwipeTransition(50, 10)).toBe(null)
    })

    it('returns null when vertical dominates', () => {
      expect(shouldSwipeTransition(30, 120)).toBe(null)
      expect(shouldSwipeTransition(-30, -120)).toBe(null)
    })

    it('returns null when exactly vertical', () => {
      expect(shouldSwipeTransition(0, 100)).toBe(null)
    })

    it('respects custom threshold', () => {
      expect(shouldSwipeTransition(-40, 5, 40)).toBe('left')
      expect(shouldSwipeTransition(-35, 5, 40)).toBe(null)
    })
  })

  describe('shouldWheelTransition', () => {
    it('returns left when accumulated deltaX exceeds threshold', () => {
      const result = shouldWheelTransition(-100, 5, 0)
      expect(result?.direction).toBe('left')
    })

    it('returns right when accumulated deltaX exceeds threshold', () => {
      const result = shouldWheelTransition(80, 5, 10)
      expect(result?.direction).toBe('right')
    })

    it('accumulates remaining delta', () => {
      const result = shouldWheelTransition(-80, 5, 10)
      expect(result?.remaining).toBe(-10)
    })

    it('returns null when vertical dominates', () => {
      expect(shouldWheelTransition(10, 50, 0)).toBe(null)
    })

    it('returns null when threshold not reached', () => {
      expect(shouldWheelTransition(-30, 5, 0)).toBe(null)
    })
  })

  describe('workflowIndex', () => {
    it('returns correct indices for workflow tabs', () => {
      expect(workflowIndex('decarb')).toBe(0)
      expect(workflowIndex('infusion')).toBe(1)
      expect(workflowIndex('dose')).toBe(2)
    })

    it('returns -1 for non-workflow tabs', () => {
      expect(workflowIndex('knowledge')).toBe(-1)
      expect(workflowIndex('dashboard')).toBe(-1)
    })
  })

  describe('clampIndex', () => {
    it('clamps to bounds', () => {
      expect(clampIndex(-1)).toBe(0)
      expect(clampIndex(0)).toBe(0)
      expect(clampIndex(1)).toBe(1)
      expect(clampIndex(2)).toBe(2)
      expect(clampIndex(3)).toBe(2)
    })
  })

  describe('WORKFLOW_TABS order', () => {
    it('is Decarb → Infusion → Dose', () => {
      expect(WORKFLOW_TABS).toEqual(['decarb', 'infusion', 'dose'])
    })
  })
})
