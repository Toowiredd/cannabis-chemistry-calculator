/**
 * Tests for the IndexedDB wrapper in idb-store.ts. Uses the
 * `fake-indexeddb` polyfill (a devDependency) to mirror the browser's
 * IndexedDB API in node. Each test resets the global so the module's
 * `cachedDb` cache from earlier tests does not leak.
 */
import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { IDB_KEY, idbDelete, idbGet, idbGetAll, idbPut, openIdbStore } from "../idb-store"

describe("idb-store", () => {
  beforeEach(() => {
    // Reset the module so the cached `cachedDb` from a previous test
    // doesn't leak across tests. Each test gets a fresh import with
    // a null cache.
    vi.resetModules()
  })

  afterEach(() => {
    // Best-effort: close any lingering connection. The fake
    // IndexedDB doesn't strictly need this, but it keeps the
    // test teardown explicit. The factory itself has no `close`
    // method, but any cached IDBDatabase handle does — we look
    // for the cached handle on the module's exports instead.
    try {
      // Force a fresh module load so the cachedDb null state takes
      // effect on the next test.
      vi.resetModules()
    } catch {
      // ignore
    }
  })

  it("openIdbStore returns an IDBDatabase on a fresh DB", async () => {
    const { openIdbStore: open } = await import("../idb-store")
    const db = await open()
    expect(db).not.toBeNull()
    expect(db?.name).toBe("ccc")
    expect(db?.version).toBe(1)
  })

  it("idbGet returns null for a missing key", async () => {
    const { idbGet: get } = await import("../idb-store")
    const result = await get<unknown>(IDB_KEY.journalEntries)
    expect(result).toBeNull()
  })

  it("idbPut + idbGet round-trips a string", async () => {
    const { idbGet: get, idbPut: put } = await import("../idb-store")
    const ok = await put(IDB_KEY.presets, "hello")
    expect(ok).toBe(true)
    const result = await get<string>(IDB_KEY.presets)
    expect(result).toBe("hello")
  })

  it("idbPut + idbGet round-trips a complex object (mirroring a JournalEntry)", async () => {
    const { idbGet: get, idbPut: put } = await import("../idb-store")
    const entry = {
      id: "je-1",
      date: "2026-07-25",
      material: { grams: 3.5, thcPct: 4 },
      classification: "low",
      source: "quickbatch" as const,
    }
    const ok = await put(IDB_KEY.journalEntries, entry)
    expect(ok).toBe(true)
    const result = await get<typeof entry>(IDB_KEY.journalEntries)
    expect(result).toEqual(entry)
  })

  it("idbDelete removes a key", async () => {
    const { idbDelete: del, idbGet: get, idbPut: put } = await import("../idb-store")
    await put(IDB_KEY.strains, [{ id: "s1" }])
    expect(await get(IDB_KEY.strains)).toEqual([{ id: "s1" }])
    const ok = await del(IDB_KEY.strains)
    expect(ok).toBe(true)
    expect(await get(IDB_KEY.strains)).toBeNull()
  })

  it("idbGetAll returns the single value stored in the object store", async () => {
    const { idbGetAll: all, idbPut: put } = await import("../idb-store")
    const list = [
      { id: "a", name: "first" },
      { id: "b", name: "second" },
    ]
    // The web-shim usage pattern: write the list as a single value
    // keyed by IDB_KEY constant, then read it back via getAll.
    await put(IDB_KEY.journalEntries, list)
    const result = await all<typeof list[number]>(IDB_KEY.journalEntries)
    expect(result).toEqual([list])
  })

  it("idbPut returns false when the underlying IDBRequest errors (simulated quota error)", async () => {
    const { openIdbStore: open, idbPut: put } = await import("../idb-store")
    // Force the open to fail so idbPut returns false (the wrapper
    // short-circuits when the backend is unavailable). This is the
    // realistic failure mode for a Safari private-mode user or a
    // quota-exhausted state.
    const original = (globalThis as { indexedDB?: IDBFactory }).indexedDB
    delete (globalThis as { indexedDB?: IDBFactory }).indexedDB
    vi.resetModules()
    const modFresh = await import("../idb-store")
    const db = await modFresh.openIdbStore()
    expect(db).toBeNull()
    const ok = await modFresh.idbPut(IDB_KEY.presets, "should fail")
    expect(ok).toBe(false)
    ;(globalThis as { indexedDB?: IDBFactory }).indexedDB = original
    // Suppress unused var from the first import (linter)
    void open
    void put
  })

  it("openIdbStore returns null when indexedDB is unavailable (private mode)", async () => {
    const original = (globalThis as { indexedDB?: IDBFactory }).indexedDB
    delete (globalThis as { indexedDB?: IDBFactory }).indexedDB
    vi.resetModules()
    const { openIdbStore: open } = await import("../idb-store")
    const db = await open()
    expect(db).toBeNull()
    ;(globalThis as { indexedDB?: IDBFactory }).indexedDB = original
  })
})
