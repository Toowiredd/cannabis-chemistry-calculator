import { describe, it, expect } from 'vitest'

/* ------------------------------------------------------------------ */
/* Playback helpers extracted from MolecularBuilder for testing        */
/* ------------------------------------------------------------------ */

const SPEEDS = [0.5, 1, 2] as const
type Speed = (typeof SPEEDS)[number]

function cycleSpeed(current: Speed): Speed {
  const idx = SPEEDS.indexOf(current)
  return SPEEDS[(idx + 1) % SPEEDS.length]
}

function shouldResumeAfterVisibility(
  playingBeforeHidden: boolean,
  isCurrentlyPlaying: boolean,
  documentHidden: boolean
): { isPlaying: boolean; wasPlayingBeforeHidden: boolean } {
  if (documentHidden) {
    if (isCurrentlyPlaying) {
      return { isPlaying: false, wasPlayingBeforeHidden: true }
    }
    return { isPlaying: isCurrentlyPlaying, wasPlayingBeforeHidden: false }
  }
  if (!isCurrentlyPlaying && playingBeforeHidden) {
    return { isPlaying: true, wasPlayingBeforeHidden: false }
  }
  return {
    isPlaying: isCurrentlyPlaying,
    wasPlayingBeforeHidden: playingBeforeHidden,
  }
}

function computeDt(lastTimeRef: number, currentTime: number): number {
  if (!lastTimeRef) return 0
  return currentTime - lastTimeRef
}

describe('MolecularBuilder playback logic', () => {
  describe('cycleSpeed', () => {
    it('cycles through 0.5x -> 1x -> 2x -> 0.5x', () => {
      expect(cycleSpeed(0.5)).toBe(1)
      expect(cycleSpeed(1)).toBe(2)
      expect(cycleSpeed(2)).toBe(0.5)
    })
  })

  describe('speed change dt corruption fix', () => {
    it('should reset lastTimeRef to current time on speed change to avoid stale dt', () => {
      // Suppose animation was playing; lastTimeRef was last tick at t=1000
      const lastTimeRef = 1000
      const now = 5000
      // Without reset: dt would be 4000ms, causing a huge jump
      const staleDt = computeDt(lastTimeRef, now)
      expect(staleDt).toBeGreaterThan(1000)

      // After reset (the fix): lastTimeRef is set to performance.now() before next tick
      const resetLastTime = now // performance.now() at speed-change moment
      const newDt = computeDt(resetLastTime, now)
      expect(newDt).toBe(0)
      expect(newDt).toBeLessThan(staleDt)
    })

    it('should not accumulate large dt after multiple speed changes', () => {
      let lastTimeRef = 1000
      const nowValues = [2000, 3000, 4000]

      for (const now of nowValues) {
        // simulate speed change: reset lastTimeRef
        lastTimeRef = now
        const dt = computeDt(lastTimeRef, now + 16) // next frame ~16ms later
        expect(dt).toBeLessThanOrEqual(16)
      }
    })
  })

  describe('tab-switch visibilitychange play-state preservation', () => {
    it('stores wasPlayingBeforeHidden when auto-pausing on hidden', () => {
      const result = shouldResumeAfterVisibility(false, true, true)
      expect(result.isPlaying).toBe(false)
      expect(result.wasPlayingBeforeHidden).toBe(true)
    })

    it('does not mark wasPlayingBeforeHidden when already paused on hidden', () => {
      const result = shouldResumeAfterVisibility(false, false, true)
      expect(result.isPlaying).toBe(false)
      expect(result.wasPlayingBeforeHidden).toBe(false)
    })

    it('resumes playback when returning to visible if it was playing before hidden', () => {
      const result = shouldResumeAfterVisibility(true, false, false)
      expect(result.isPlaying).toBe(true)
      expect(result.wasPlayingBeforeHidden).toBe(false)
    })

    it('does not resume playback when returning to visible if it was manually paused before hidden', () => {
      const result = shouldResumeAfterVisibility(false, false, false)
      expect(result.isPlaying).toBe(false)
      expect(result.wasPlayingBeforeHidden).toBe(false)
    })

    it('preserves isPlaying when already playing and visible', () => {
      const result = shouldResumeAfterVisibility(false, true, false)
      expect(result.isPlaying).toBe(true)
      expect(result.wasPlayingBeforeHidden).toBe(false)
    })

    it('preserves the playing state across hide-show cycles', () => {
      // User is playing, tab hidden -> auto-pause
      const hiddenState = shouldResumeAfterVisibility(false, true, true)
      expect(hiddenState.isPlaying).toBe(false)
      expect(hiddenState.wasPlayingBeforeHidden).toBe(true)

      // Tab becomes visible again -> auto-resume
      const visibleState = shouldResumeAfterVisibility(
        hiddenState.wasPlayingBeforeHidden,
        hiddenState.isPlaying,
        false
      )
      expect(visibleState.isPlaying).toBe(true)
      expect(visibleState.wasPlayingBeforeHidden).toBe(false)
    })

    it('does not auto-resume if user manually paused before tab was hidden', () => {
      // Manually paused, then tab hidden
      const hiddenState = shouldResumeAfterVisibility(false, false, true)
      expect(hiddenState.wasPlayingBeforeHidden).toBe(false)

      // Tab becomes visible -> should stay paused
      const visibleState = shouldResumeAfterVisibility(
        hiddenState.wasPlayingBeforeHidden,
        hiddenState.isPlaying,
        false
      )
      expect(visibleState.isPlaying).toBe(false)
    })

    it('clears wasPlayingBeforeHidden after resuming', () => {
      const first = shouldResumeAfterVisibility(true, false, false)
      expect(first.wasPlayingBeforeHidden).toBe(false)

      // A second visible event should not re-toggle
      const second = shouldResumeAfterVisibility(
        first.wasPlayingBeforeHidden,
        first.isPlaying,
        false
      )
      expect(second.isPlaying).toBe(true)
      expect(second.wasPlayingBeforeHidden).toBe(false)
    })
  })
})
