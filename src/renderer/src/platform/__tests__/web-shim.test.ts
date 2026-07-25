/**
 * Tests for the web shim's `webApp` export. The shim wraps
 * localStorage + (now) IndexedDB for the PWA build. The vitest
 * config sets `environment: 'jsdom'` + `fake-indexeddb/auto` is
 * imported at the top of the test so IDB is available.
 *
 * We import `webApp` directly (rather than going through `window.App`,
 * which is only installed by `bootstrap.ts` in production entry points).
 * The shim's runtime shape is identical to `window.App`'s shape.
 */
import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { idbDelete, idbGet, IDB_KEY } from "../idb-store"
import { webApp } from "../web-shim"

describe("web-shim (presets + strains persistence + IDB mirror)", () => {
  beforeEach(() => {
    // Reset localStorage between tests so each test sees a clean
    // store. The shim is module-level — its dualWriteJson helper
    // reads from localStorage + IDB; we want both clean.
    try {
      localStorage.clear()
    } catch {
      // jsdom-only; ignore
    }
  })

  afterEach(() => {
    try {
      localStorage.clear()
    } catch {
      // ignore
    }
  })

  it("saveStrains + loadStrains round-trips a list", async () => {
    const list = [
      { id: "s1", name: "OG Kush" },
      { id: "s2", name: "Sour Diesel" },
    ]
    const save = await webApp.saveStrains(list)
    expect(save.success).toBe(true)
    const load = await webApp.loadStrains()
    expect(load.success).toBe(true)
    expect(load.strains).toEqual(list)
  })

  it("saveStrains mirrors the list to IndexedDB (durability fallback)", async () => {
    const list = [{ id: "s1", name: "OG Kush" }]
    const save = await webApp.saveStrains(list)
    expect(save.success).toBe(true)
    // Allow the fire-and-forget IDB write to complete.
    await new Promise(r => setTimeout(r, 50))
    // Read directly from IDB to confirm the mirror fired.
    const idbValue = await idbGet<unknown[]>(IDB_KEY.strains)
    expect(idbValue).toEqual(list)
  })

  it("loadStrains falls back to IDB when localStorage is empty (Safari eviction simulation)", async () => {
    // First write — populates both localStorage and IDB.
    const list = [{ id: "s1", name: "OG Kush" }]
    await webApp.saveStrains(list)
    await new Promise(r => setTimeout(r, 50))
    // Simulate a Safari localStorage eviction: clear localStorage
    // but leave IDB intact.
    try {
      localStorage.clear()
    } catch {
      // ignore
    }
    // Next read should hydrate from IDB.
    const load = await webApp.loadStrains()
    expect(load.success).toBe(true)
    expect(load.strains).toEqual(list)
  })

  it("savePreset records the preset in the index (localStorage + IDB)", async () => {
    const save = await webApp.savePreset({
      name: "My first batch",
      presetData: { tabs: { decarb: { weight: "3.5" } } },
    })
    expect(save.success).toBe(true)
    expect(save.filePath).toMatch(/^localStorage:\/\//)
  })

  it("savePreset rejects a duplicate name", async () => {
    const r1 = await webApp.savePreset({
      name: "My first batch",
      presetData: { tabs: {} },
    })
    expect(r1.success).toBe(true)
    const r2 = await webApp.savePreset({
      name: "My first batch",
      presetData: { tabs: {} },
    })
    expect(r2.success).toBe(false)
    expect(r2.error).toMatch(/already exists/i)
  })

  it("savePreset rejects an empty name", async () => {
    const r = await webApp.savePreset({ name: "   ", presetData: {} })
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/empty/i)
  })
})

describe("web-shim (journal entries persistence + IDB mirror)", () => {
  beforeEach(async () => {
    try {
      localStorage.clear()
    } catch {
      // ignore
    }
    // Clear the journal IDB blob too — the journal IDB mirror
    // survives across tests (fake-indexeddb persists in the same
    // process), so a previous test that left entries behind would
    // leak into this one via the IDB fallback path.
    await idbDelete(IDB_KEY.journalEntries)
  })

  afterEach(() => {
    try {
      localStorage.clear()
    } catch {
      // ignore
    }
  })

  it("saveJournalEntry round-trips a single entry through localStorage", async () => {
    const r = await webApp.saveJournalEntry({
      date: "2026-07-25",
      material: { grams: 3.5, thcPct: 4 },
      classification: "low",
    })
    expect(r.success).toBe(true)
    expect(r.id).toMatch(/^entry_/)
    const load = await webApp.loadJournalEntries()
    expect(load.success).toBe(true)
    expect(load.entries).toHaveLength(1)
    expect(load.entries[0].classification).toBe("low")
  })

  it("saveJournalEntry mirrors the index + entries to IndexedDB", async () => {
    await webApp.saveJournalEntry({
      date: "2026-07-25",
      material: { grams: 3.5, thcPct: 4 },
    })
    await webApp.saveJournalEntry({
      date: "2026-07-24",
      material: { grams: 7, thcPct: 18 },
    })
    // Allow the fire-and-forget IDB writes to complete.
    await new Promise(r => setTimeout(r, 50))
    const blob = await idbGet<{
      index: { id: string; date: string; savedAt: string }[]
      entries: Record<string, Record<string, unknown>>
    }>(IDB_KEY.journalEntries)
    expect(blob).not.toBeNull()
    expect(blob?.index).toHaveLength(2)
    expect(Object.keys(blob?.entries ?? {})).toHaveLength(2)
    // Index should be newest-first (date-descending).
    expect(blob?.index[0].date).toBe("2026-07-25")
  })

  it("loadJournalEntries recovers from a Safari localStorage eviction (IDB fallback)", async () => {
    // 1. Save two entries — populates localStorage + IDB.
    await webApp.saveJournalEntry({
      date: "2026-07-25",
      material: { grams: 3.5 },
    })
    await webApp.saveJournalEntry({
      date: "2026-07-24",
      material: { grams: 7 },
    })
    await new Promise(r => setTimeout(r, 50))
    // 2. Simulate a Safari sweep: clear localStorage but leave IDB.
    localStorage.clear()
    // 3. Next read should hydrate from IDB and return both entries.
    const load = await webApp.loadJournalEntries()
    expect(load.success).toBe(true)
    expect(load.entries).toHaveLength(2)
    // 4. localStorage should now be re-hydrated from IDB.
    expect(localStorage.getItem("ccc:journal-index")).not.toBeNull()
  })

  it("deleteJournalEntry removes from localStorage and the IDB blob", async () => {
    const r1 = await webApp.saveJournalEntry({
      date: "2026-07-25",
      tag: "first",
    })
    const r2 = await webApp.saveJournalEntry({
      date: "2026-07-24",
      tag: "second",
    })
    expect(r1.id).toBeDefined()
    expect(r2.id).toBeDefined()
    await new Promise(r => setTimeout(r, 50))
    // Delete the first entry
    const del = await webApp.deleteJournalEntry(r1.id!)
    expect(del.success).toBe(true)
    await new Promise(r => setTimeout(r, 50))
    // IDB blob should now only contain the second entry.
    const blob = await idbGet<{
      index: { id: string }[]
      entries: Record<string, Record<string, unknown>>
    }>(IDB_KEY.journalEntries)
    expect(blob?.index).toHaveLength(1)
    expect(blob?.index[0].id).toBe(r2.id)
    // loadJournalEntries should return only the remaining entry.
    const load = await webApp.loadJournalEntries()
    expect(load.entries).toHaveLength(1)
    expect(load.entries[0].tag).toBe("second")
  })

  it("loadJournalEntries returns empty array when both localStorage and IDB are empty", async () => {
    const load = await webApp.loadJournalEntries()
    expect(load.success).toBe(true)
    expect(load.entries).toEqual([])
  })
})
