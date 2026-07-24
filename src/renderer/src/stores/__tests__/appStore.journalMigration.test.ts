/**
 * appStore — JournalEntry provenance (v1→v2) migration guard.
 *
 * The 2026-07-25 ccc-uiux-reviewer (BLOCKER B1) and
 * ccc-workflow-validator reports both flagged that `JournalEntry`
 * had no `source` field — every save dropped provenance. The
 * state-slice fix is:
 *
 *   1. Add a `JournalEntrySource` literal-union type and an
 *      optional `source?: JournalEntrySource` field on
 *      `JournalEntry` (appStore.ts:280-333).
 *   2. Bump the persist `version` from 1 to 2 (appStore.ts:1021)
 *      and add a `version < 2` migration branch
 *      (appStore.ts:1076-1117) that backfills `source: 'unknown'`
 *      on every existing journal entry.
 *
 * This file locks in that migration behaviour so a future
 * refactor of the v1→v2 block (or the literal-union type) can't
 * silently regress the provenance gap. The two failure modes the
 * tests cover:
 *
 *   A. Legacy v1 snapshot with no `source` field on any entry →
 *      the migration stamps `'unknown'` on every entry so the
 *      Journal tab can render a "Saved by: Unknown" badge for
 *      pre-provenance entries.
 *   B. A v2-shaped snapshot that already has a valid `source` →
 *      the migration is idempotent and preserves the existing
 *      value (running the migration twice doesn't double-stamp).
 *
 * Plus edge cases: a snapshot with no `journalEntries` field at
 * all (the common case — v1 partialize never persisted them), an
 * empty `journalEntries` array, and the chained v0→v2 upgrade
 * that must run BOTH the wizard and the journal backfill.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAppStore } from '../appStore'

const STORAGE_KEY = 'cannabis-chem-units'

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

interface PersistedEnvelope {
  state: Record<string, unknown>
  version: number
}

/** Build a realistic legacy `JournalEntry` with NO `source` field. */
function buildLegacyEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry_legacy_1',
    date: '2026-01-01',
    strainName: 'OG Kush',
    strainId: null,
    materialWeight: '3.5',
    thcaPct: '20',
    thcPct: '0',
    cbdaPct: '0',
    cbdPct: '0',
    methodId: 'oven_sealed',
    methodName: 'Oven Sealed',
    fatId: 'coconut',
    fatName: 'Coconut oil',
    servings: '10',
    mgPerServing: '50',
    classification: 'standard',
    totalInfusedThc: '500',
    concentration: '5',
    volume: '100',
    volumeUnit: 'mL',
    notes: 'Pre-provenance legacy entry.',
    ...overrides,
  }
}

/** Read the persisted envelope from localStorage. */
function readPersisted(): PersistedEnvelope | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw == null) return null
  return JSON.parse(raw)
}

/** Reset the journal slice to a deterministic empty state. */
function resetJournal(): void {
  useAppStore.setState({ journalEntries: [] })
}

beforeEach(() => {
  localStorage.clear()
  resetJournal()
})

afterEach(() => {
  localStorage.clear()
  resetJournal()
})

/* ------------------------------------------------------------------ */
/* A. v1 → v2 — backfill source: 'unknown' on legacy entries          */
/* ------------------------------------------------------------------ */

describe('appStore persist — v1 → v2 migration (JournalEntry.source backfill)', () => {
  it('stamps source: "unknown" on every legacy journal entry in a v1 snapshot', async () => {
    // Realistic v1 envelope: a snapshot persisted at version 1, with
    // a journalEntries array whose entries pre-date the source field.
    // The migration must stamp `source: 'unknown'` on every entry so
    // consumers can rely on a present value.
    const v1Envelope: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        journalEntries: [
          buildLegacyEntry({ id: 'entry_1', date: '2026-01-01' }),
          buildLegacyEntry({ id: 'entry_2', date: '2026-01-02' }),
        ],
      },
      version: 1,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1Envelope))

    await useAppStore.persist.rehydrate()

    const entries = useAppStore.getState().journalEntries
    expect(entries).toHaveLength(2)
    // Both entries must have the legacy sentinel, and every other
    // field must survive intact (the migration must not drop data).
    expect(entries[0].source).toBe('unknown')
    expect(entries[0].id).toBe('entry_1')
    expect(entries[0].strainName).toBe('OG Kush')
    expect(entries[0].volumeUnit).toBe('mL')
    expect(entries[1].source).toBe('unknown')
    expect(entries[1].id).toBe('entry_2')
  })

  it('is a no-op on a v1 snapshot that has no journalEntries field at all', async () => {
    // The v1 partialize never persisted `journalEntries` (they live
    // on disk in localStorage / IPC), so the most common v1 snapshot
    // has no field. The migration must not crash, and the runtime
    // default (`journalEntries: []`) must remain.
    const v1Envelope: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        // No journalEntries field — this is the normal v1 shape.
      },
      version: 1,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1Envelope))

    await useAppStore.persist.rehydrate()

    expect(useAppStore.getState().journalEntries).toEqual([])
  })

  it('is a no-op on an empty journalEntries array', async () => {
    const v1Envelope: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        journalEntries: [],
      },
      version: 1,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1Envelope))

    await useAppStore.persist.rehydrate()

    expect(useAppStore.getState().journalEntries).toEqual([])
  })

  it('preserves a pre-existing valid source value (idempotent on v2-shaped snapshots)', async () => {
    // If a snapshot already has a valid `source` literal (e.g. it was
    // written by a build that already had the v2 schema), the
    // migration must NOT overwrite it. This makes the migration
    // idempotent — running it twice on a v2 snapshot is safe.
    const v2Envelope: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        journalEntries: [
          buildLegacyEntry({
            id: 'entry_qb',
            source: 'quickbatch',
          }),
          buildLegacyEntry({
            id: 'entry_ftg',
            source: 'first_timer_guide',
          }),
          buildLegacyEntry({
            id: 'entry_jf',
            source: 'journal_form',
          }),
        ],
      },
      version: 2,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v2Envelope))

    await useAppStore.persist.rehydrate()

    const entries = useAppStore.getState().journalEntries
    expect(entries).toHaveLength(3)
    expect(entries[0].source).toBe('quickbatch')
    expect(entries[1].source).toBe('first_timer_guide')
    expect(entries[2].source).toBe('journal_form')
  })

  it('replaces an invalid source value with "unknown" (defensive against bad data)', async () => {
    // A snapshot that claims `source: 'quackbatch'` (typo / older
    // build) is invalid. The migration must coerce the bad value to
    // 'unknown' rather than propagate the typo. This keeps consumers
    // from having to defend against a source value outside the
    // literal union.
    const dirtyEnvelope: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        journalEntries: [
          buildLegacyEntry({ id: 'entry_typo', source: 'quackbatch' }),
          buildLegacyEntry({ id: 'entry_num', source: 42 }),
        ],
      },
      version: 1,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dirtyEnvelope))

    await useAppStore.persist.rehydrate()

    const entries = useAppStore.getState().journalEntries
    expect(entries[0].source).toBe('unknown')
    expect(entries[1].source).toBe('unknown')
  })

  it('chained v0 → v2 upgrade: wizard slice backfill AND journal source backfill both run', async () => {
    // A v0 envelope has neither `wizard` nor `journalEntries.source`.
    // The chained migration (v0→v1 then v1→v2) must run BOTH
    // backfills: the wizard must be created with empty array keys,
    // AND every journal entry must get `source: 'unknown'`. If the
    // v0→v1 block early-returns (the original pre-fix code did), the
    // journal backfill is silently skipped on the v0→v2 path.
    const v0Envelope: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        // No wizard, no journalEntries — the snapshot pre-dates
        // both the wizard slice (v1) and the journal source field
        // (v2).
        journalEntries: [buildLegacyEntry({ id: 'entry_v0' })],
      },
      version: 0,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v0Envelope))

    await useAppStore.persist.rehydrate()

    // Wizard backfill: the runtime fields reset, arrays are [].
    const w = useAppStore.getState().wizard
    expect(w.dismissed).toBe(false)
    expect(w.active).toBe(false)
    expect(w.stepIndex).toBe(0)
    expect(w.selections).toEqual({
      equipment: [],
      decarbMethodIds: [],
      fatIds: [],
      formatIds: [],
    })
    // Journal backfill: the legacy entry got `source: 'unknown'`.
    const entries = useAppStore.getState().journalEntries
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('entry_v0')
    expect(entries[0].source).toBe('unknown')
  })

  it('persisted envelope is upgraded to version 2 after rehydrate', async () => {
    // Sanity: the persist middleware flushes the migrated envelope
    // back to localStorage at the current version. Future runs of
    // the app must see `version: 2`, not `version: 1` — otherwise
    // the migration would re-run on every launch.
    const v1Envelope: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        journalEntries: [buildLegacyEntry()],
      },
      version: 1,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1Envelope))

    await useAppStore.persist.rehydrate()

    // Give the debounced persist writer a moment to flush.
    for (let i = 0; i < 50; i++) {
      const persisted = readPersisted()
      if (persisted?.version === 2) break
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    expect(readPersisted()?.version).toBe(2)
  })
})
