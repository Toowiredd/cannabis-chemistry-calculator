/**
 * IndexedDB wrapper for the PWA web shim.
 *
 * The web shim in `web-shim.ts` provides the same `window.App` surface the
 * Electron preload bridge exposes, but for the browser build. Today it
 * persists presets / journal entries / strains via `localStorage`.
 *
 * `localStorage` is per-origin and iOS Safari can evict it under storage
 * pressure (the "Clear website data" sweep, offsite iCloud cookie
 * eviction). IndexedDB is more durable: it's quota-bounded by the
 * browser (typically a few hundred MB on iOS) and survives most
 * "private mode" quirks.
 *
 * This module is the durable fallback. The web shim writes through
 * BOTH `localStorage` (synchronous fast path) AND IndexedDB
 * (durable async path). On read, the shim prefers `localStorage` and
 * falls back to IndexedDB if `localStorage` is empty (e.g. after a
 * Safari eviction sweep).
 *
 * Object stores created here:
 *   - `journalEntries` (key: `ccc:journalEntries` — list, not a
 *     single row, matches the `localStorage` key)
 *   - `presets` (key: `ccc:presets`)
 *   - `strains` (key: `ccc:strains`)
 *
 * Schema version: 1. No migrations needed at this layer because the
 * `localStorage` round-trip contract is the source of truth for
 * shape; IndexedDB just mirrors it.
 *
 * @see web-shim.ts for the consumer
 */
const DB_NAME = 'ccc'
const DB_VERSION = 1

/**
 * The IndexedDB key paths used by this module. Match the `localStorage`
 * key naming so a future cross-platform migration can switch keys
 * with a one-line find/replace.
 */
export const IDB_KEY = {
  journalEntries: 'ccc:journalEntries',
  presets: 'ccc:presets',
  strains: 'ccc:strains',
} as const

export type IdbStoreName = (typeof IDB_KEY)[keyof typeof IDB_KEY]

/** Per-store object store names. One store per IDB_KEY. */
const STORE_NAMES: Readonly<Record<IdbStoreName, string>> = {
  [IDB_KEY.journalEntries]: 'journalEntries',
  [IDB_KEY.presets]: 'presets',
  [IDB_KEY.strains]: 'strains',
}

let cachedDb: IDBDatabase | null = null
let openFailed = false

/**
 * Open the `ccc` IndexedDB database. Idempotent within a process —
 * subsequent calls return the cached handle.
 *
 * Returns `null` if IndexedDB is unavailable (private mode, disabled
 * in browser settings, or the open threw). The web shim treats a null
 * return as "durable backend not available, fall back to localStorage
 * only".
 */
export function openIdbStore(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }
  if (openFailed) {
    return Promise.resolve(null)
  }
  if (cachedDb) {
    return Promise.resolve(cachedDb)
  }
  return new Promise(resolve => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      // Some browsers throw synchronously (e.g. when the database
      // name is invalid). Treat as unavailable.
      openFailed = true
      resolve(null)
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      for (const storeName of Object.values(STORE_NAMES)) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName)
        }
      }
    }
    req.onsuccess = () => {
      cachedDb = req.result
      // If the connection drops (e.g. version mismatch on another
      // tab), clear the cache so the next call reopens.
      cachedDb.onclose = () => {
        cachedDb = null
      }
      resolve(cachedDb)
    }
    req.onerror = () => {
      openFailed = true
      resolve(null)
    }
    req.onblocked = () => {
      // Another tab is holding the database open at an older
      // version. Don't block forever — let the caller fall back.
      openFailed = true
      resolve(null)
    }
  })
}

/** Internal: get the object store name for an IDB_KEY constant. */
function storeName(key: IdbStoreName): string {
  return STORE_NAMES[key]
}

/**
 * Get a value from the IndexedDB store. Returns `null` if the key
 * does not exist, the backend is unavailable, or the value is
 * unparseable.
 */
export async function idbGet<T>(key: IdbStoreName): Promise<T | null> {
  const db = await openIdbStore()
  if (!db) return null
  return new Promise(resolve => {
    let tx: IDBTransaction
    try {
      tx = db.transaction(storeName(key), 'readonly')
    } catch {
      resolve(null)
      return
    }
    const store = tx.objectStore(storeName(key))
    let req: IDBRequest
    try {
      req = store.get(key)
    } catch {
      resolve(null)
      return
    }
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null)
    req.onerror = () => resolve(null)
  })
}

/**
 * Put a value into the IndexedDB store. Returns `true` on success,
 * `false` on any error (quota exceeded, backend unavailable, the
 * store was deleted out from under us). The web shim treats `false`
 * as "durable write failed, localStorage is the only copy" — a
 * non-fatal warning, not a user-facing error.
 */
export async function idbPut<T>(key: IdbStoreName, value: T): Promise<boolean> {
  const db = await openIdbStore()
  if (!db) return false
  return new Promise(resolve => {
    let tx: IDBTransaction
    try {
      tx = db.transaction(storeName(key), 'readwrite')
    } catch {
      resolve(false)
      return
    }
    const store = tx.objectStore(storeName(key))
    let req: IDBRequest
    try {
      req = store.put(value, key)
    } catch {
      resolve(false)
      return
    }
    req.onsuccess = () => resolve(true)
    req.onerror = () => {
      // Quota exceeded surfaces here. Don't crash — fall back to
      // localStorage only. The web shim logs the failure.
      resolve(false)
    }
  })
}

/** Delete a value from the IndexedDB store. */
export async function idbDelete(key: IdbStoreName): Promise<boolean> {
  const db = await openIdbStore()
  if (!db) return false
  return new Promise(resolve => {
    let tx: IDBTransaction
    try {
      tx = db.transaction(storeName(key), 'readwrite')
    } catch {
      resolve(false)
      return
    }
    const store = tx.objectStore(storeName(key))
    let req: IDBRequest
    try {
      req = store.delete(key)
    } catch {
      resolve(false)
      return
    }
    req.onsuccess = () => resolve(true)
    req.onerror = () => resolve(false)
  })
}

/** Get all values from the IndexedDB store. */
export async function idbGetAll<T>(key: IdbStoreName): Promise<T[]> {
  const db = await openIdbStore()
  if (!db) return []
  return new Promise(resolve => {
    let tx: IDBTransaction
    try {
      tx = db.transaction(storeName(key), 'readonly')
    } catch {
      resolve([])
      return
    }
    const store = tx.objectStore(storeName(key))
    let req: IDBRequest
    try {
      req = store.getAll()
    } catch {
      resolve([])
      return
    }
    req.onsuccess = () => resolve((req.result as T[]) ?? [])
    req.onerror = () => resolve([])
  })
}
