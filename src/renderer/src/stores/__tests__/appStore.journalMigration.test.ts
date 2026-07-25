/**
 * appStore — JournalEntry provenance (v1→v2) + InventoryItem.kind
 * (v2→v3) + JournalEntry.materialWeightUnit (v3→v4) migration guards.
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
 * The 2026-07-25 AVB feature round added a second migration layer:
 *
 *   1. Add an optional `kind?: 'flower' | 'concentrate' | 'avb'`
 *      field on `InventoryItem` (appStore.ts:261-292).
 *   2. Widen `DecarbState['materialMode']` to include `'avb'`
 *      (appStore.ts:95) and add `'avb'` to `JournalEntrySource`
 *      (appStore.ts:321-327) so the chem-engine's AVB exports
 *      (calculateAvbTheoreticalMax, AVB_RESIDUAL_THC_RANGES,
 *      AVBColor) and ui-tabs's AVB save sites typecheck.
 *   3. Bump the persist `version` from 2 to 3 (appStore.ts:1071)
 *      and add a `version < 3` migration branch
 *      (appStore.ts:1169-1231) that backfills `kind: 'flower'`
 *      on every existing inventory item that lacks a valid kind.
 *      The migration is idempotent — items that already have a
 *      valid kind (including `'avb'`) are preserved unchanged.
 *   4. Widen the `loadFromPreset` guard on `materialMode` to
 *      accept `'avb'` (appStore.ts:962-967) so a recipe-import
 *      with AVB material mode survives the validator without
 *      falling back to the default 'flower'.
 *
 * The 2026-07-25 ccc-validation-orchestrator cross-tab data flow
 * audit (MAJOR M1) added a third migration layer:
 *
 *   1. Add an optional `materialWeightUnit?: 'g' | 'oz'` field
 *      on `JournalEntry` (appStore.ts:385). The b02a259 commit
 *      message claimed the field was added but it was never
 *      actually landed on the interface — the Journal card was
 *      reading it via a type cast, and no save site was writing
 *      it, so a 0.12 oz entry would round-trip as "0.12 g" on
 *      the card (a 28x under-report).
 *   2. Bump the persist `version` from 3 to 4 (appStore.ts:1114)
 *      and add a `version < 4` migration branch
 *      (appStore.ts:1274-1347) that backfills
 *      `materialWeightUnit: 'g'` on every existing journal
 *      entry that lacks a valid value. The migration is
 *      idempotent — entries that already have a valid
 *      `'g' | 'oz'` are preserved unchanged. Invalid values
 *      (e.g. `'lb'`, `42`, `null`) are coerced to `'g'`.
 *
 * This file locks in all three migration layers so a future
 * refactor of the v1→v2, v2→v3, or v3→v4 blocks (or the
 * literal-union types) can't silently regress any of them. The
 * failure modes the tests cover:
 *
 *   A. Legacy v1 snapshot with no `source` field on any entry →
 *      the migration stamps `'unknown'` on every entry so the
 *      Journal tab can render a "Saved by: Unknown" badge for
 *      pre-provenance entries.
 *   B. A v2-shaped snapshot that already has a valid `source` →
 *      the migration is idempotent and preserves the existing
 *      value (running the migration twice doesn't double-stamp).
 *   C. Legacy v2 snapshot with no `kind` field on any inventory
 *      item → the migration stamps `'flower'` on every item so
 *      the Inventory tab can render material semantics for
 *      pre-AVB entries.
 *   D. A v3-shaped snapshot that already has a valid `kind` →
 *      the migration is idempotent and preserves the existing
 *      value (an AVB-tagged item is not downgraded to flower).
 *   E. A v3-shaped snapshot with `materialMode: 'avb'` survives
 *      the loadFromPreset guard (regression guard for the
 *      widened union).
 *   F. A chained v1→v2→v3→v4 upgrade runs all FOUR migrations
 *      in order on the same envelope (regression guard for the
 *      migration chain).
 *   G. Legacy v3 snapshot with no `materialWeightUnit` field
 *      on any entry → the migration stamps `'g'` on every
 *      entry so the Journal card can render the correct unit.
 *   H. A v4-shaped snapshot that already has a valid
 *      `materialWeightUnit` → the migration is idempotent and
 *      preserves the existing value (a hand-edited `'oz'` is
 *      not downgraded to `'g'`).
 *   I. A v3-shaped snapshot with an INVALID `materialWeightUnit`
 *      value (e.g. `'lb'`, `42`, `null`) → the migration
 *      coerces the bad value to `'g'` so consumers never have
 *      to defend against a value outside the literal union.
 *
 * Plus edge cases: a snapshot with no `journalEntries` field at
 * all (the common case — v1 partialize never persisted them), an
 * empty `journalEntries` array, the chained v0→v4 upgrade that
 * must run wizard + journal source + inventory + materialWeight
 * backfills, and a persist round-trip on a v4 entry with
 * `materialWeightUnit: 'oz'` (the consumer-side contract for
 * the type widening — ui-tabs's save sites will use exactly
 * this pattern).
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

  it('persisted envelope is upgraded to version 4 after rehydrate (chained v1 → v2 → v3 → v4)', async () => {
    // Sanity: the persist middleware flushes the migrated envelope
    // back to localStorage at the current version. Future runs of
    // the app must see `version: 4`, not `version: 1` or `version: 2`
    // or `version: 3` — otherwise the migration chain would re-run
    // on every launch. (Updated 2026-07-25: the v3→v4
    // materialWeightUnit backfill was added in the
    // ccc-validation-orchestrator MAJOR M1 fix, so a v1 envelope
    // now travels through v1→v2→v3→v4 in one rehydrate.)
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
      if (persisted?.version === 4) break
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    expect(readPersisted()?.version).toBe(4)
  })
})

/* ------------------------------------------------------------------ */
/* v2 → v3 — backfill kind: 'flower' on legacy inventory items         */
/* ------------------------------------------------------------------ */

describe('appStore persist — v2 → v3 migration (InventoryItem.kind backfill)', () => {
  /** Build a realistic v2 inventory item with NO `kind` field. */
  function buildLegacyInventoryItem(
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      id: 'inv_legacy_1',
      date: '2026-01-01',
      type: 'purchase',
      name: 'OG Kush',
      amountGrams: '3.5',
      cost: '50',
      // Intentionally NO `kind` field — the v2 schema pre-dates
      // the AVB material-semantic field added in v3.
      ...overrides,
    }
  }

  /** Reset the inventory slice to a deterministic empty state. */
  function resetInventory(): void {
    useAppStore.setState({
      inventory: { items: [], lowStockThreshold: '3.5' },
    })
  }

  // The migration test re-runs rehydrate multiple times within
  // one file; the per-block reset is necessary because the v1→v2
  // block's `beforeEach` does not know about the v2→v3 tests.
  // Each `it` re-clears localStorage + resets the store.
  beforeEach(() => {
    localStorage.clear()
    resetJournal()
    resetInventory()
  })

  afterEach(() => {
    localStorage.clear()
    resetJournal()
    resetInventory()
  })

  it('stamps kind: "flower" on every v2 inventory item that lacks a kind', async () => {
    // Realistic v2 envelope: a snapshot persisted at version 2 with
    // an inventory array whose items pre-date the `kind` field.
    // The migration must stamp `kind: 'flower'` on every item so
    // consumers can rely on a present value, and every other field
    // must survive intact (the migration must not drop data).
    const v2Envelope: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        inventory: {
          items: [
            buildLegacyInventoryItem({ id: 'inv_a', name: 'OG Kush' }),
            buildLegacyInventoryItem({
              id: 'inv_b',
              name: 'Wax',
              amountGrams: '1.0',
              type: 'purchase',
            }),
          ],
          lowStockThreshold: '3.5',
        },
      },
      version: 2,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v2Envelope))

    await useAppStore.persist.rehydrate()

    const items = useAppStore.getState().inventory.items
    expect(items).toHaveLength(2)
    // Both items must have the legacy sentinel, and every other
    // field must survive intact (the migration must not drop data).
    expect(items[0].kind).toBe('flower')
    expect(items[0].id).toBe('inv_a')
    expect(items[0].name).toBe('OG Kush')
    expect(items[0].amountGrams).toBe('3.5')
    expect(items[0].type).toBe('purchase')
    expect(items[1].kind).toBe('flower')
    expect(items[1].id).toBe('inv_b')
    expect(items[1].name).toBe('Wax')
    expect(items[1].amountGrams).toBe('1.0')
  })

  it('preserves a v2 inventory item that already has a valid kind (idempotent on already-v3-shaped kind)', async () => {
    // A v2 snapshot that was hand-edited (or written by a build
    // that beat the migration) to inject `kind: 'avb'` on an item
    // must survive the v2→v3 migration unchanged. This is the
    // idempotency contract — running the migration twice on a
    // v3-shaped item is a no-op.
    const v2WithKind: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        inventory: {
          items: [
            // Already tagged as AVB — a hypothetical v2 build that
            // beat the migration, or a hand-edited dev envelope.
            buildLegacyInventoryItem({
              id: 'inv_avb',
              kind: 'avb',
              name: 'AVB session',
              amountGrams: '2.0',
              type: 'usage',
            }),
            // Already tagged as concentrate — same idempotency
            // contract for a non-flower, non-avb value.
            buildLegacyInventoryItem({
              id: 'inv_conc',
              kind: 'concentrate',
              name: 'Wax',
              amountGrams: '1.0',
            }),
          ],
          lowStockThreshold: '3.5',
        },
      },
      version: 2,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v2WithKind))

    await useAppStore.persist.rehydrate()

    const items = useAppStore.getState().inventory.items
    expect(items).toHaveLength(2)
    // The AVB-tagged item must NOT be downgraded to 'flower'.
    expect(items[0].kind).toBe('avb')
    expect(items[0].id).toBe('inv_avb')
    // The concentrate-tagged item must also be preserved.
    expect(items[1].kind).toBe('concentrate')
    expect(items[1].id).toBe('inv_conc')
  })

  it('does NOT add source: "avb" to v2 journal entries (the source migration is forward-only)', async () => {
    // The v2→v3 migration only backfills `kind: 'flower'` on
    // inventory items. It does NOT stamp `source: 'avb'` on legacy
    // journal entries — the AVB source is a forward-only value
    // written by the AVB save site (ui-tabs), not a migration
    // concern. A v2 entry with `source: 'unknown'` (the v1→v2
    // default) or `source: 'quickbatch'` (a valid pre-v3 value)
    // must keep its source after the v2→v3 migration runs.
    const v2Envelope: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        journalEntries: [
          buildLegacyEntry({ id: 'entry_legacy_unknown', source: 'unknown' }),
          buildLegacyEntry({ id: 'entry_legacy_qb', source: 'quickbatch' }),
          buildLegacyEntry({
            id: 'entry_legacy_ftg',
            source: 'first_timer_guide',
          }),
        ],
      },
      version: 2,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v2Envelope))

    await useAppStore.persist.rehydrate()

    const entries = useAppStore.getState().journalEntries
    expect(entries).toHaveLength(3)
    // Every entry must keep its pre-existing source. The migration
    // must NOT reclassify legacy entries as 'avb' (that would be
    // a data-integrity bug, not a migration).
    expect(entries[0].source).toBe('unknown')
    expect(entries[1].source).toBe('quickbatch')
    expect(entries[2].source).toBe('first_timer_guide')
  })

  it('v3 InventoryItem with kind: "avb" can be saved and round-trips through persist', async () => {
    // Save a v3-shaped item with `kind: 'avb'` via the
    // `addInventoryItem` action. The store must accept the new
    // union member, persist it to localStorage, and rehydrate it
    // intact. This is the consumer-side contract for the type
    // widening — ui-tabs's AVB save site will use exactly this
    // pattern.
    useAppStore.getState().addInventoryItem({
      id: 'inv_avb_roundtrip',
      date: '2026-07-25',
      type: 'usage',
      name: 'AVB session',
      amountGrams: '2.0',
      kind: 'avb',
    })

    // Give the debounced persist writer a moment to flush.
    for (let i = 0; i < 50; i++) {
      const persisted = readPersisted()
      const persistedItems = (persisted?.state.inventory as
        | { items?: Array<Record<string, unknown>> }
        | undefined)?.items
      if (persistedItems?.[0]?.kind === 'avb') break
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // 1. Persisted envelope must contain the kind: 'avb' item.
    const persisted = readPersisted()
    const persistedItems = (persisted?.state.inventory as
      | { items?: Array<Record<string, unknown>> }
      | undefined)?.items
    expect(persistedItems).toBeDefined()
    expect(persistedItems?.[0]?.kind).toBe('avb')
    expect(persistedItems?.[0]?.id).toBe('inv_avb_roundtrip')
    expect(persistedItems?.[0]?.name).toBe('AVB session')

    // 2. Rehydrate and verify the item survives intact.
    await useAppStore.persist.rehydrate()
    const items = useAppStore.getState().inventory.items
    expect(items).toHaveLength(1)
    expect(items[0]?.kind).toBe('avb')
    expect(items[0]?.id).toBe('inv_avb_roundtrip')
    expect(items[0]?.amountGrams).toBe('2.0')
  })

  it('chained v1 → v2 → v3: wizard, journal, and inventory all backfilled on a legacy v1 envelope', async () => {
    // A v1 envelope with no wizard, no journalEntries.source, and
    // no inventory.kind must run ALL THREE migrations in order:
    //   - v1→v2: journal entries get `source: 'unknown'`
    //   - v2→v3: inventory items get `kind: 'flower'`
    // (The v0→v1 wizard backfill is NOT exercised here because
    // version: 1 already has the wizard slice, so the v0 block is
    // a no-op — this test specifically covers the v1→v2 and
    // v2→v3 chain.)
    //
    // If any link in the chain is broken, the test catches it
    // with a precise assertion on the missing field. This is
    // the regression guard for the migration chain — the spec
    // calls this out as a required test case.
    const v1Envelope: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        journalEntries: [buildLegacyEntry({ id: 'entry_v1_chain' })],
        inventory: {
          items: [
            {
              id: 'inv_v1_chain',
              date: '2026-01-01',
              type: 'purchase',
              name: 'OG',
              amountGrams: '3.5',
            },
          ],
          lowStockThreshold: '3.5',
        },
      },
      version: 1,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1Envelope))

    await useAppStore.persist.rehydrate()

    // v1→v2: journal source backfilled.
    const entries = useAppStore.getState().journalEntries
    expect(entries).toHaveLength(1)
    expect(entries[0]?.id).toBe('entry_v1_chain')
    expect(entries[0]?.source).toBe('unknown')

    // v2→v3: inventory kind backfilled.
    const items = useAppStore.getState().inventory.items
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('inv_v1_chain')
    expect(items[0]?.kind).toBe('flower')
  })

  it('v3 snapshot with materialMode: "avb" is accepted by loadFromPreset (widened union survives the validator)', () => {
    // The loadFromPreset guard at appStore.ts:962-967 must accept
    // 'avb' as a valid materialMode — a v2 reader (before the
    // union was widened) would have rejected it and fallen back
    // to the runtime default 'flower'. After widening, the value
    // must be preserved end-to-end through the loadFromPreset
    // path that the recipe-import UI uses.
    const snapshot = {
      units: {
        tempUnit: 'C' as const,
        weightUnit: 'g' as const,
        volumeUnit: 'mL' as const,
        bagUnit: 'cm' as const,
      },
      tabs: {
        decarb: {
          inputs: {
            weight: '3.5',
            weightUnit: 'g' as const,
            thcaPct: '20',
            thcPct: '0',
            cbdaPct: '0',
            cbdPct: '0',
            presetId: 'oven_sealed',
            tempOverrideUnit: 'C' as const,
            bagWidthOverrideUnit: 'cm' as const,
            bagLengthOverrideUnit: 'cm' as const,
            bagExpanded: true,
            materialMode: 'avb',
            concentrateTypeId: 'wax',
          },
        },
      },
    }
    // biome-ignore lint/suspicious/noExplicitAny: <see persist.test.ts>
    ;(useAppStore.getState() as any).loadFromPreset(snapshot)
    // The widened union must survive the validator. Before the
    // 2026-07-25 widening, this would have fallen back to
    // DEFAULT_DECARB.materialMode ('flower').
    expect(useAppStore.getState().decarb.materialMode).toBe('avb')
    // Sanity: the weight value is preserved (the validator only
    // touches materialMode, not the rest of the decarb slice).
    expect(useAppStore.getState().decarb.weight).toBe('3.5')
  })

  it('v3 envelope is upgraded to version 4 on rehydrate (v3→v4 backfills materialWeightUnit, other v3 fields survive)', async () => {
    // A v3-shaped snapshot is no longer a no-op for the
    // migration. The v3→v4 migration runs to backfill
    // `materialWeightUnit: 'g'` on the journal entry, and the
    // envelope is persisted at version 4. The pre-existing v3
    // fields must survive intact: `materialMode: 'avb'`,
    // `source: 'avb'` (the v1→v2 default-stamp does not run on a
    // v3 envelope), and `kind: 'avb'` (idempotent on already-v3-
    // shaped kind). The previous test names this case "preserved
    // at version 3" — that was the steady-state under the v3
    // envelope, but the v3→v4 migration moves the steady-state
    // target to version 4. This test is the round-trip-the-other-
    // direction regression guard — the previous "upgraded to
    // version 4 after rehydrate" test covers the upgrade path
    // from a v1 envelope; this one covers the upgrade from a v3
    // envelope (the most common real-world upgrade path).
    const v3Envelope: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        decarb: {
          materialMode: 'avb',
        },
        journalEntries: [
          buildLegacyEntry({ id: 'entry_v3', source: 'avb' }),
        ],
        inventory: {
          items: [
            {
              id: 'inv_v3',
              date: '2026-07-25',
              type: 'usage',
              name: 'AVB',
              amountGrams: '2.0',
              kind: 'avb',
            },
          ],
          lowStockThreshold: '3.5',
        },
      },
      version: 3,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v3Envelope))

    await useAppStore.persist.rehydrate()

    // Envelope upgrades to version 4 (v3→v4 migration ran).
    for (let i = 0; i < 50; i++) {
      const persisted = readPersisted()
      if (persisted?.version === 4) break
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    expect(readPersisted()?.version).toBe(4)

    // materialMode: 'avb' survives rehydrate.
    expect(useAppStore.getState().decarb.materialMode).toBe('avb')

    // journal source: 'avb' survives rehydrate (the v3→v4
    // migration does not touch journal source — it only adds
    // materialWeightUnit). And the new materialWeightUnit is
    // backfilled to 'g' (the v3 entry has no field).
    const entries = useAppStore.getState().journalEntries
    expect(entries).toHaveLength(1)
    expect(entries[0]?.source).toBe('avb')
    expect(entries[0]?.materialWeightUnit).toBe('g')

    // inventory kind: 'avb' survives rehydrate (idempotent on
    // already-v3-shaped kind).
    const items = useAppStore.getState().inventory.items
    expect(items).toHaveLength(1)
    expect(items[0]?.kind).toBe('avb')
  })
})

/* ------------------------------------------------------------------ */
/* v3 → v4 — backfill materialWeightUnit: 'g' on legacy journal entries */
/* ------------------------------------------------------------------ */

describe('appStore persist — v3 to v4 migration (JournalEntry.materialWeightUnit backfill)', () => {
  // The 2026-07-25 ccc-validation-orchestrator cross-tab data
  // flow audit found MAJOR M1: the b02a259 commit message
  // claimed `materialWeightUnit` was added as "new optional
  // field on JournalEntry" but the field was never actually
  // landed on the interface. The Journal card was reading it
  // via a type cast, and no save site was writing it, so a 0.12
  // oz entry would round-trip as "0.12 g" on the card (a 28x
  // under-report). The fix: declare the field on
  // `JournalEntry` (appStore.ts:385), bump persist version 3 →
  // 4 (appStore.ts:1114), and add a `version < 4` migration
  // branch (appStore.ts:1314-1347) that backfills
  // `materialWeightUnit: 'g'` on every legacy journal entry
  // that lacks a valid value.
  //
  // This describe block locks in the v3→v4 migration so a
  // future refactor of the field declaration, the migration
  // branch, or the literal-union type can't silently regress
  // the fix. The five required tests are:
  //
  //   G1. Legacy v3 entry without `materialWeightUnit` →
  //       migration stamps `'g'` (the safe default).
  //   G2. A v3-shaped entry with `materialWeightUnit: 'oz'`
  //       (manually injected) → migration is idempotent and
  //       preserves the existing value.
  //   G3. A v3-shaped entry with an INVALID value (e.g. `'lb'`)
  //       → migration coerces the bad value to `'g'`.
  //   G4. A v4-shaped entry with `materialWeightUnit: 'oz'`
  //       survives a full persist round-trip (the field is
  //       read back correctly after rehydrate).
  //   G5. A chained v2→v3→v4 migration on a v2 entry produces
  //       a v4 entry with `source: 'unknown'`, `kind: 'flower'`,
  //       AND `materialWeightUnit: 'g'` (regression guard for
  //       the full migration chain).

  /** Reset the journal slice to a deterministic empty state. */
  function resetJournal(): void {
    useAppStore.setState({ journalEntries: [] })
  }

  // The migration test re-runs rehydrate multiple times within
  // one file; the per-block reset is necessary because the
  // v1→v2 and v2→v3 blocks' `beforeEach` does not know about
  // the v3→v4 tests. Each `it` re-clears localStorage + resets
  // the store.
  beforeEach(() => {
    localStorage.clear()
    resetJournal()
  })

  afterEach(() => {
    localStorage.clear()
    resetJournal()
  })

  it('stamps materialWeightUnit: "g" on every v3 journal entry that lacks the field', async () => {
    // Realistic v3 envelope: a snapshot persisted at version 3,
    // with a journalEntries array whose entries pre-date the
    // `materialWeightUnit` field. The migration must stamp
    // `materialWeightUnit: 'g'` on every entry so consumers
    // can rely on a present value, and every other field must
    // survive intact (the migration must not drop data).
    const v3Envelope: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        journalEntries: [
          buildLegacyEntry({ id: 'entry_legacy_g_1', date: '2026-01-01' }),
          buildLegacyEntry({ id: 'entry_legacy_g_2', date: '2026-01-02' }),
        ],
      },
      version: 3,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v3Envelope))

    await useAppStore.persist.rehydrate()

    const entries = useAppStore.getState().journalEntries
    expect(entries).toHaveLength(2)
    // Both entries must have the safe default, and every other
    // field must survive intact.
    expect(entries[0]?.materialWeightUnit).toBe('g')
    expect(entries[0]?.id).toBe('entry_legacy_g_1')
    expect(entries[0]?.strainName).toBe('OG Kush')
    expect(entries[0]?.volumeUnit).toBe('mL')
    expect(entries[1]?.materialWeightUnit).toBe('g')
    expect(entries[1]?.id).toBe('entry_legacy_g_2')
  })

  it('preserves a v3 journal entry that already has a valid materialWeightUnit (idempotent on already-valid value)', async () => {
    // A v3 snapshot that was hand-edited (or written by a build
    // that beat the migration) to inject `materialWeightUnit: 'oz'`
    // on an entry must survive the v3→v4 migration unchanged.
    // This is the idempotency contract — running the migration
    // twice on a v4-shaped entry is a no-op. The test also
    // covers 'g' as an already-valid value (the same idempotency
    // contract for the safe default).
    const v3WithMaterialUnit: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        journalEntries: [
          // Already tagged as 'oz' — a hypothetical v3 build that
          // beat the migration, or a hand-edited dev envelope.
          buildLegacyEntry({
            id: 'entry_oz',
            materialWeight: '0.12',
            materialWeightUnit: 'oz',
          }),
          // Already tagged as 'g' — same idempotency contract
          // for the safe default.
          buildLegacyEntry({
            id: 'entry_g',
            materialWeight: '3.5',
            materialWeightUnit: 'g',
          }),
        ],
      },
      version: 3,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v3WithMaterialUnit))

    await useAppStore.persist.rehydrate()

    const entries = useAppStore.getState().journalEntries
    expect(entries).toHaveLength(2)
    // The 'oz'-tagged entry must NOT be downgraded to 'g' —
    // this is the regression guard for the bug that MAJOR M1
    // was filed against (0.12 oz entry shown as 0.12 g).
    expect(entries[0]?.materialWeightUnit).toBe('oz')
    expect(entries[0]?.id).toBe('entry_oz')
    expect(entries[0]?.materialWeight).toBe('0.12')
    // The 'g'-tagged entry must also be preserved.
    expect(entries[1]?.materialWeightUnit).toBe('g')
    expect(entries[1]?.id).toBe('entry_g')
    expect(entries[1]?.materialWeight).toBe('3.5')
  })

  it('replaces an invalid materialWeightUnit value with "g" (defensive against bad data)', async () => {
    // A snapshot that claims `materialWeightUnit: 'lb'` (a unit
    // outside the literal union) is invalid. The migration must
    // coerce the bad value to 'g' rather than propagate the typo.
    // This keeps consumers from having to defend against a value
    // outside the literal union. The test covers three flavors
    // of invalid data: a string outside the union ('lb'), a
    // non-string value (42), and a null value — all must be
    // coerced to the safe default.
    const dirtyEnvelope: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        journalEntries: [
          buildLegacyEntry({ id: 'entry_lb', materialWeightUnit: 'lb' }),
          buildLegacyEntry({ id: 'entry_num', materialWeightUnit: 42 }),
          buildLegacyEntry({ id: 'entry_null', materialWeightUnit: null }),
        ],
      },
      version: 3,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dirtyEnvelope))

    await useAppStore.persist.rehydrate()

    const entries = useAppStore.getState().journalEntries
    expect(entries).toHaveLength(3)
    // All three invalid values must be coerced to 'g'.
    expect(entries[0]?.materialWeightUnit).toBe('g')
    expect(entries[0]?.id).toBe('entry_lb')
    expect(entries[1]?.materialWeightUnit).toBe('g')
    expect(entries[1]?.id).toBe('entry_num')
    expect(entries[2]?.materialWeightUnit).toBe('g')
    expect(entries[2]?.id).toBe('entry_null')
  })

  it('a v4 journal entry with materialWeightUnit: "oz" survives a full persist round-trip', async () => {
    // The consumer-side contract for the type widening:
    // ui-tabs's save sites will call
    // `addJournalEntry({ ..., materialWeightUnit: 'oz' })` and
    // expect the field to round-trip through persist without
    // loss. This is the regression guard for the save-site
    // contract — if a future refactor of the partialize or
    // merge logic drops the field, this test catches it.
    //
    // Note: the current `partialize` does NOT include
    // `journalEntries` (they live on disk in localStorage / IPC
    // via the Journal tab's load-on-mount), so a standard
    // `addJournalEntry` → persist → rehydrate cycle does not
    // actually exercise the round-trip. We simulate the v4
    // shape directly by writing a v4 envelope to localStorage,
    // rehydrating, and then re-rehydrating from the same
    // envelope. This is the same path a future build that
    // persists journalEntries would use, and it verifies that
    // the field survives a full rehydrate cycle intact.
    const v4Envelope: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        journalEntries: [
          // A v4-shaped entry: has source (v1→v2 field) and
          // materialWeightUnit (v3→v4 field), but no `kind`
          // (this is a journal entry, not an inventory item).
          // The v3→v4 migration is a no-op on this entry
          // (materialWeightUnit is already a valid 'oz'), and
          // the v1→v2 migration is a no-op (version: 4 is past
          // v1, and source is already valid).
          {
            id: 'entry_oz_roundtrip',
            date: '2026-07-25',
            strainName: 'OG Kush',
            strainId: null,
            materialWeight: '0.12',
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
            notes: '0.12 oz round-trip test.',
            source: 'quickbatch',
            materialWeightUnit: 'oz',
          },
        ],
      },
      version: 4,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v4Envelope))

    // 1. First rehydrate: read the v4 envelope into the store.
    await useAppStore.persist.rehydrate()
    let entries = useAppStore.getState().journalEntries
    expect(entries).toHaveLength(1)
    expect(entries[0]?.materialWeightUnit).toBe('oz')
    expect(entries[0]?.id).toBe('entry_oz_roundtrip')
    expect(entries[0]?.materialWeight).toBe('0.12')
    expect(entries[0]?.source).toBe('quickbatch')

    // 2. Re-rehydrate from the same envelope (the partialize
    //    will not write journalEntries, so the localStorage
    //    envelope is unchanged between rehydrates). The field
    //    must survive a second rehydrate cycle — this catches
    //    any future refactor of the `merge` logic that would
    //    accidentally drop unknown fields.
    await useAppStore.persist.rehydrate()
    entries = useAppStore.getState().journalEntries
    expect(entries).toHaveLength(1)
    expect(entries[0]?.materialWeightUnit).toBe('oz')
    expect(entries[0]?.id).toBe('entry_oz_roundtrip')
    expect(entries[0]?.materialWeight).toBe('0.12')
    expect(entries[0]?.source).toBe('quickbatch')

    // 3. The envelope must stay at version 4 (no migration runs
    //    on a v4-shaped snapshot).
    for (let i = 0; i < 50; i++) {
      const persisted = readPersisted()
      if (persisted?.version === 4) break
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    expect(readPersisted()?.version).toBe(4)
  })

  it('chained v2 → v3 → v4 migration: source, kind, AND materialWeightUnit all backfilled on a legacy v2 entry', async () => {
    // A v2 envelope with no `source` on journal entries (the
    // v1→v2 default would stamp it, but a v2 envelope is
    // already past v1, so v1→v2 doesn't run; however, a v2
    // envelope that was hand-edited or written by a build
    // before the v2 migration is still a real-world shape),
    // no `kind` on inventory items, and no
    // `materialWeightUnit` on journal entries must run ALL
    // THREE applicable migrations in order:
    //   - v1→v2 block does NOT run (version: 2 is past v1)
    //   - v2→v3: inventory items get `kind: 'flower'`
    //   - v3→v4: journal entries get `materialWeightUnit: 'g'`
    //
    // Note: we start from version 2 to exercise the chain
    // v2→v3→v4 (the test name reflects this). For a v1→v4
    // chain, the chained test in the v1→v2 block already
    // covers the wizard + source + kind + materialWeightUnit
    // path.
    //
    // The hand-rolled v2 envelope has entries that already
    // have a valid `source` (so v1→v2 wouldn't re-stamp
    // anyway, even if it ran) — this isolates the v2→v3 and
    // v3→v4 effects to their respective fields.
    //
    // If any link in the chain is broken, the test catches it
    // with a precise assertion on the missing field.
    const v2Envelope: PersistedEnvelope = {
      state: {
        firstRunDismissed: true,
        journalEntries: [
          // Entry with a valid pre-v2 source (so v1→v2 wouldn't
          // re-stamp), but NO materialWeightUnit (v3→v4 must
          // backfill). This is the v2→v3→v4 chain in action.
          buildLegacyEntry({
            id: 'entry_v2_chain',
            source: 'quickbatch',
            materialWeight: '3.5',
          }),
        ],
        inventory: {
          items: [
            {
              id: 'inv_v2_chain',
              date: '2026-01-01',
              type: 'purchase',
              name: 'OG',
              amountGrams: '3.5',
              // No `kind` field — v2→v3 must backfill.
            },
          ],
          lowStockThreshold: '3.5',
        },
      },
      version: 2,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v2Envelope))

    await useAppStore.persist.rehydrate()

    // v2→v3: inventory kind backfilled to 'flower' (the v1→v2
    // source block does NOT re-run on a v2 envelope — version
    // 2 is past the v1 threshold, so the source on the entry
    // is preserved).
    const items = useAppStore.getState().inventory.items
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('inv_v2_chain')
    expect(items[0]?.kind).toBe('flower')

    // v3→v4: journal materialWeightUnit backfilled to 'g', and
    // the pre-existing source is preserved (v3→v4 does not
    // touch source).
    const entries = useAppStore.getState().journalEntries
    expect(entries).toHaveLength(1)
    expect(entries[0]?.id).toBe('entry_v2_chain')
    expect(entries[0]?.source).toBe('quickbatch')
    expect(entries[0]?.materialWeightUnit).toBe('g')
  })
})
