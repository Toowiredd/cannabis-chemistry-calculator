/**
 * StrainManager — audit-fix regression tests for the 2026-07-25
 * ccc uiux-reviewer M7 fix.
 *
 * Coverage:
 * - The close button (X icon) has an `aria-label` so it's
 *   discoverable to assistive tech.
 * - The per-strain edit button (Pencil icon) has an `aria-label`
 *   that includes the strain name so a long list is
 *   distinguishable.
 * - The per-strain delete button (Trash2 icon) has an `aria-label`
 *   that includes the strain name. Deletion is destructive so the
 *   affordance must be unambiguous.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { StrainManager } from '../StrainManager'
import { useAppStore } from '../../stores/appStore'

/* jsdom matchMedia stub. */
beforeEach(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  }
})

describe('StrainManager — audit M7 (icon button aria-labels)', () => {
  beforeEach(() => {
    // Seed two saved strains so the list renders with both
    // per-strain icon buttons present.
    useAppStore.setState({
      strains: [
        {
          id: 'strain_og',
          name: 'OG Kush',
          type: 'indica',
          thcaPct: 22,
          thcPct: 1,
          cbdaPct: 0,
          cbdPct: 0,
          notes: '',
        },
        {
          id: 'strain_blue',
          name: 'Blue Dream',
          type: 'hybrid',
          thcaPct: 18,
          thcPct: 1,
          cbdaPct: 0,
          cbdPct: 0,
          notes: '',
        },
      ],
    })
  })

  it('the close button has an accessible name', () => {
    render(<StrainManager onClose={() => {}} open={true} />)
    // Accessible name is the aria-label "Close strain library".
    const closeBtn = screen.getByRole('button', {
      name: /Close strain library/i,
    })
    expect(closeBtn).toBeTruthy()
    expect(closeBtn.getAttribute('aria-label')).toBe('Close strain library')
  })

  it('each per-strain edit button has an aria-label naming the strain (audit M7)', () => {
    render(<StrainManager onClose={() => {}} open={true} />)
    // The audit fix uses `aria-label={`Edit ${strain.name}`}` so
    // the two buttons must be distinguishable for screen readers.
    const editOg = screen.getByRole('button', { name: /Edit OG Kush/i })
    const editBlue = screen.getByRole('button', { name: /Edit Blue Dream/i })
    expect(editOg).toBeTruthy()
    expect(editBlue).toBeTruthy()
  })

  it('each per-strain delete button has an aria-label naming the strain (audit M7)', () => {
    render(<StrainManager onClose={() => {}} open={true} />)
    const deleteOg = screen.getByRole('button', { name: /Delete OG Kush/i })
    const deleteBlue = screen.getByRole('button', {
      name: /Delete Blue Dream/i,
    })
    expect(deleteOg).toBeTruthy()
    expect(deleteBlue).toBeTruthy()
  })
})
