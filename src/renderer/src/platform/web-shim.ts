/**
 * Web shim for `window.App` — implements the same surface the Electron
 * preload exposes (see src/preload/index.ts + src/renderer/src/global.d.ts)
 * using browser APIs only.
 *
 * The Electron build keeps the real preload; this shim is only installed
 * by `bootstrap.ts` when running in a plain browser context. The shim
 * exists so the React renderer source can stay agnostic of platform —
 * every `window.App.exportReport(...)` call site works the same.
 *
 * Storage strategy (2026-07-25 durability upgrade):
 *   - localStorage: synchronous fast path for presets, strains,
 *     and the journal index + per-entry rows. Subject to Safari
 *     eviction under storage pressure.
 *   - IndexedDB (`idb-store.ts`): durable async mirror of every
 *     write. Survives localStorage eviction. Read fallback: if
 *     localStorage is empty but IndexedDB has the value, hydrate
 *     from IndexedDB (one-time recovery after a Safari sweep).
 *   - Blob URLs for downloads (no write access to a real filesystem)
 *   - navigator.clipboard for copy
 *   - window.open for external links (noopener)
 *
 * Failure handling: every IDB call is wrapped in `try/catch` at the
 * module boundary (see `idb-store.ts`). If the IDB backend is
 * unavailable (private mode, disabled, quota exhausted), the shim
 * falls back to localStorage-only — non-fatal warning, not a
 * user-facing error.
 *
 * Persistence caveat:
 *   - Journal entries can grow unbounded; if a user hits BOTH the
 *     localStorage ~5MB quota AND the IDB quota, saveJournalEntry
 *     returns { success: false, error: 'Storage quota exceeded' }.
 */

import { IDB_KEY, idbDelete, idbGet, idbPut } from './idb-store'

const PREFIX = 'ccc:'

function lsKey(key: string): string {
  return `${PREFIX}${key}`
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(lsKey(key))
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(lsKey(key), JSON.stringify(value))
}

/**
 * Dual-write a JSON value to BOTH localStorage (synchronous fast path)
 * AND IndexedDB (durable async mirror). The IDB write is fire-and-
 * forget — if it fails (quota, private mode, disabled), the shim
 * still works on localStorage only. The IDB layer is durability,
 * not correctness: the localStorage copy is always written first.
 *
 * The `idbKey` parameter maps the localStorage key (e.g. `presets`)
 * to one of the `IDB_KEY` constants (e.g. `IDB_KEY.presets`).
 * The mapping is mechanical: `presets` → `IDB_KEY.presets`. If you
 * add a new persistence function, add the new key to BOTH the
 * localStorage PREFIX and `IDB_KEY` in idb-store.ts.
 */
function dualWriteJson<T>(
  lsKeyName: string,
  idbKey: (typeof IDB_KEY)[keyof typeof IDB_KEY],
  value: T
): void {
  // 1. Synchronous localStorage write — the source of truth for
  //    the rest of the shim.
  localStorage.setItem(lsKey(lsKeyName), JSON.stringify(value))
  // 2. Async IDB mirror — fire-and-forget. Catch + log to keep
  //    the IDB failure off the user-facing path.
  void idbPut(idbKey, value).catch(() => {
    // IDB write failed (quota, private mode, disabled). The
    // localStorage copy is still correct. The shim continues
    // working on localStorage only — durability is degraded, but
    // correctness is preserved.
  })
}

/**
 * Read a JSON value from localStorage; fall back to IndexedDB if
 * localStorage is empty. Used by the read paths to recover from a
 * Safari localStorage eviction: if the user just opened the PWA
 * and localStorage is empty, we hydrate the first read from IDB.
 */
async function readJsonWithIdbFallback<T>(
  lsKeyName: string,
  idbKey: (typeof IDB_KEY)[keyof typeof IDB_KEY],
  fallback: T
): Promise<T> {
  // localStorage read first (synchronous fast path)
  try {
    const raw = localStorage.getItem(lsKey(lsKeyName))
    if (raw != null) {
      return JSON.parse(raw) as T
    }
  } catch {
    // localStorage read failed (corrupt JSON, etc.). Fall through
    // to IDB.
  }
  // Fallback: try IDB
  const idbValue = await idbGet<T>(idbKey)
  if (idbValue != null) {
    // Hydrate localStorage from IDB so the next read is fast.
    try {
      localStorage.setItem(lsKey(lsKeyName), JSON.stringify(idbValue))
    } catch {
      // localStorage write also failed (quota). IDB is the only
      // copy. The shim continues working with the IDB fallback
      // on every read — slower but correct.
    }
    return idbValue
  }
  return fallback
}

function lsQuotaError(err: unknown): string {
  if (err instanceof Error) {
    if (
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    ) {
      return 'Browser storage quota exceeded. Delete old journal entries or presets and try again.'
    }
    return err.message
  }
  return 'Unknown storage error'
}

/* ------------------------------------------------------------------ */
/* Journal IDB mirror                                                  */
/* ------------------------------------------------------------------ */

/**
 * The single-blob shape stored under `IDB_KEY.journalEntries`. Holds
 * the full journal state (index + every per-entry row) in one
 * structured-cloneable value so a Safari localStorage eviction can be
 * recovered with a single IDB get.
 *
 * The blob is rewritten on every save/delete. Average journals are
 * <500 entries of a few KB each; the IDB write fits in a single
 * transaction. For pathological 10k+ entry journals the IDB write
 * becomes a hot spot — at that point we should switch to per-entry
 * rows, but the single-blob layout keeps the code simple today and
 * matches the same single-blob pattern we use for presets/strains.
 */
interface JournalIdbBlob {
  index: { id: string; date: string; savedAt: string }[]
  entries: Record<string, Record<string, unknown>>
}

/**
 * Mirror the current journal state (index + per-entry rows) to
 * IndexedDB under `IDB_KEY.journalEntries`. Read-modify-write: we
 * re-read the current IDB blob (if any) to preserve entries that
 * haven't been touched by this call. Returns when the IDB write
 * resolves (or rejects on quota / private-mode errors).
 */
async function mirrorJournalToIdb(
  index: { id: string; date: string; savedAt: string }[]
): Promise<void> {
  // Build the per-entry rows from localStorage (the source of truth).
  const entries: Record<string, Record<string, unknown>> = {}
  for (const meta of index) {
    const e = readJson<Record<string, unknown> | null>(
      `journal:${meta.id}`,
      null
    )
    if (e) entries[meta.id] = e
  }
  // If the IDB already has a blob, prefer the IDB copy of any entry
  // we don't have locally — defends against a partial localStorage
  // eviction where the index survived but some per-entry rows did
  // not. In practice the loop above reads localStorage and that is
  // the most-recent write, so this is mostly a safety net.
  const existing = await idbGet<JournalIdbBlob>(IDB_KEY.journalEntries)
  if (existing?.entries) {
    for (const [id, e] of Object.entries(existing.entries)) {
      if (!(id in entries) && e) entries[id] = e
    }
  }
  await idbPut<JournalIdbBlob>(IDB_KEY.journalEntries, { index, entries })
}

/** Sort entries newest-first by `date` (or `savedAt` fallback). */
function sortEntriesByDateDesc(
  entries: Record<string, unknown>[]
): Record<string, unknown>[] {
  return [...entries].sort((a, b) => {
    const ad =
      typeof a.date === 'string'
        ? a.date
        : typeof a.savedAt === 'string'
          ? a.savedAt
          : ''
    const bd =
      typeof b.date === 'string'
        ? b.date
        : typeof b.savedAt === 'string'
          ? b.savedAt
          : ''
    return bd.localeCompare(ad)
  })
}

/* ------------------------------------------------------------------ */
/* Preset index — tracks presets saved on the web (used by load dialog)*/
/* ------------------------------------------------------------------ */

interface PresetIndexEntry {
  id: string
  name: string
  createdAt: string
}

function loadPresetIndex(): PresetIndexEntry[] {
  return readJson<PresetIndexEntry[]>('preset-index', [])
}

function savePresetIndex(index: PresetIndexEntry[]): void {
  writeJson('preset-index', index)
}

function pickFileJson(): Promise<{
  success: boolean
  canceled?: boolean
  error?: string
  data?: Record<string, unknown>
}> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.style.position = 'fixed'
    input.style.left = '-10000px'
    document.body.appendChild(input)

    let settled = false
    const cleanup = () => {
      if (!settled) {
        settled = true
        document.body.removeChild(input)
      }
    }

    input.addEventListener('change', () => {
      const file = input.files?.[0]
      cleanup()
      if (!file) {
        resolve({ success: false, canceled: true })
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const text = String(reader.result ?? '')
          const parsed = JSON.parse(text)
          if (typeof parsed !== 'object' || parsed === null) {
            resolve({
              success: false,
              error: 'Cannot load preset: file is not a valid preset',
            })
            return
          }
          const preset = parsed as Record<string, unknown>
          if (!preset.tabs || typeof preset.tabs !== 'object') {
            resolve({
              success: false,
              error: 'Cannot load preset: missing tab data',
            })
            return
          }
          resolve({ success: true, data: preset })
        } catch {
          resolve({
            success: false,
            error: 'Cannot load preset: invalid JSON format',
          })
        }
      }
      reader.onerror = () => {
        resolve({ success: false, error: 'Failed to read file' })
      }
      reader.readAsText(file)
    })

    // User-cancel: some browsers don't fire 'cancel', so add a focus
    // listener — when focus returns to the window, if the input has no
    // files and we never settled, treat as cancel.
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => {
          if (!settled && (!input.files || input.files.length === 0)) {
            cleanup()
            resolve({ success: false, canceled: true })
          }
        }, 300)
      },
      { once: true }
    )

    input.click()
  })
}

function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke after the click handler has had a chance to read the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ------------------------------------------------------------------ */
/* The shim                                                            */
/* ------------------------------------------------------------------ */

export const webApp = {
  window: {
    // No-op in a browser tab — there is no OS window to control.
    minimize: () => {},
    maximize: () => {},
    close: () => {},
  },

  async exportReport(data: {
    defaultFileName: string
    textContent: string
    jsonContent: string
  }): Promise<{ canceled: boolean; filePath?: string; jsonPath?: string }> {
    try {
      // Mirror the desktop behavior: write the .txt and a sibling .json.
      // Browser downloads can't show a save-as dialog without File System
      // Access API (not on iOS Safari as of this writing), so we trigger
      // two downloads back-to-back. The user picks the location via the
      // browser's normal download UI.
      const baseName = data.defaultFileName.replace(/\.txt$/i, '')
      const txtName = `${baseName}.txt`
      const jsonName = `${baseName}.json`

      downloadBlob(txtName, data.textContent, 'text/plain;charset=utf-8')
      // Slight delay so the second download doesn't get coalesced or
      // rejected by the browser as a duplicate.
      await new Promise(r => setTimeout(r, 150))
      downloadBlob(jsonName, data.jsonContent, 'application/json')

      return { canceled: false, filePath: txtName, jsonPath: jsonName }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export'
      // Best-effort: surface the error by throwing — the caller in the
      // renderer currently doesn't await errors here, but the dialog
      // is not shown anyway. Better than silent failure.
      throw new Error(message)
    }
  },

  async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
      // Fallback for older browsers / non-secure contexts.
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-10000px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  },

  async savePreset(data: {
    name: string
    presetData: Record<string, unknown>
  }): Promise<{ success: boolean; error?: string; filePath?: string }> {
    try {
      const name = data.name.trim()
      if (!name) {
        return { success: false, error: 'Preset name cannot be empty' }
      }

      const index = loadPresetIndex()
      if (index.some(p => p.name === name)) {
        return {
          success: false,
          error:
            'A preset with this name already exists. Choose a different name.',
        }
      }

      const id = `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const payload = {
        name,
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        ...data.presetData,
      }

      writeJson(`preset:${id}`, payload)
      // Mirror the full preset index to IDB on every save. The
      // single-row IDB layout (`IDB_KEY.presets`) is a JSON array
      // identical to the localStorage index. IDB is the durability
      // layer; localStorage remains the read fast path.
      void idbPut(IDB_KEY.presets, index).catch(() => {
        // IDB write failed — localStorage is the only copy.
      })
      index.push({ id, name, createdAt: payload.createdAt })
      savePresetIndex(index)

      return { success: true, filePath: `localStorage://${id}` }
    } catch (err) {
      return { success: false, error: lsQuotaError(err) }
    }
  },

  async loadPresetDialog(): Promise<{
    success: boolean
    error?: string
    data?: Record<string, unknown>
    canceled?: boolean
  }> {
    const index = loadPresetIndex()

    if (index.length === 0) {
      // No saved presets on this device — fall back to a file picker
      // so the user can still load a .json exported from the desktop.
      return pickFileJson()
    }

    // If there ARE saved presets, present a chooser. We use a synchronous
    // window.prompt fallback chain: prompt only accepts a single string,
    // so we synthesize a numbered list. If the user cancels, return
    // canceled. If they type a number, load that one. If they type
    // 'f' (file), open the file picker.
    const list = index
      .map((p, i) => `${i + 1}. ${p.name}  (${p.createdAt.slice(0, 10)})`)
      .join('\n')
    const choice = window.prompt(
      `Load a saved preset (enter a number), or 'f' to pick a .json file:\n\n${list}`,
      '1'
    )
    if (choice == null) {
      return { success: false, canceled: true }
    }
    const trimmed = choice.trim().toLowerCase()
    if (trimmed === 'f' || trimmed === 'file') {
      return pickFileJson()
    }
    const n = Number.parseInt(trimmed, 10)
    if (Number.isNaN(n) || n < 1 || n > index.length) {
      return { success: false, error: 'Invalid selection' }
    }
    const entry = index[n - 1]
    const data = readJson<Record<string, unknown> | null>(
      `preset:${entry.id}`,
      null
    )
    if (!data) {
      return { success: false, error: 'Preset data is missing or corrupt' }
    }
    return { success: true, data }
  },

  async saveStrains(data: unknown): Promise<{ success: boolean; error?: string; filePath?: string }> {
    try {
      // Single-row IDB mirror: the strains list is one IDB entry
      // under IDB_KEY.strains. IDB is the durability layer; the
      // synchronous localStorage write is the source of truth for
      // the next read.
      dualWriteJson('strains', IDB_KEY.strains, data)
      return { success: true, filePath: 'localStorage://strains' }
    } catch (err) {
      return { success: false, error: lsQuotaError(err) }
    }
  },

  async loadStrains(): Promise<{
    success: boolean
    error?: string
    strains: unknown[]
  }> {
    try {
      // IDB fallback: if localStorage is empty (e.g. after a Safari
      // eviction sweep), read from the durable IDB layer. The
      // readJsonWithIdbFallback helper also re-hydrates localStorage
      // from IDB so the next read is fast.
      const strains = await readJsonWithIdbFallback<unknown[]>(
        'strains',
        IDB_KEY.strains,
        []
      )
      if (!Array.isArray(strains)) {
        return { success: true, strains: [] }
      }
      return { success: true, strains }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load strains'
      return { success: false, error: message, strains: [] }
    }
  },

  async saveJournalEntry(
    data: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string; id?: string; filePath?: string }> {
    try {
      const index = readJson<{ id: string; date: string; savedAt: string }[]>(
        'journal-index',
        []
      )
      const id =
        typeof data.id === 'string' && data.id
          ? data.id
          : `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

      // Type the payload explicitly: spreading `Record<string, unknown>`
      // into a literal would otherwise narrow the type to only the
      // explicit fields, hiding any `date` (or other) property the
      // caller included. The merged type lets us read `payload.date`
      // below.
      const payload: Record<string, unknown> & { id: string; savedAt: string } = {
        ...data,
        id,
        savedAt: new Date().toISOString(),
      }
      writeJson(`journal:${id}`, payload)

      const existing = index.findIndex(e => e.id === id)
      const entry: { id: string; date: string; savedAt: string } = {
        id,
        date: typeof payload.date === 'string' ? payload.date : payload.savedAt,
        savedAt: payload.savedAt,
      }
      if (existing >= 0) {
        index[existing] = entry
      } else {
        index.push(entry)
      }
      // Sort newest first
      index.sort((a, b) => b.date.localeCompare(a.date))
      saveJsonQuoted('journal-index', index)

      // Mirror the full journal state to IndexedDB. The IDB blob is
      // { index, entries } so a single read on the next load
      // reconstructs the full state (used by loadJournalEntries'
      // Safari-eviction fallback). Per-entry rows would be more
      // efficient on large journals, but the average journal is
      // <500 entries x a few KB — well under the IDB blob limit
      // and small enough for a single transactional write.
      //
      // We AWAIT the mirror (rather than fire-and-forget like the
      // preset/strain paths) because the read-modify-write pattern
      // has a real concurrency hazard: two saves in flight would
      // each read the previous IDB state and stomp on each other.
      // Forcing a serial write per save keeps localStorage and IDB
      // in lock-step. The cost is one IDB write per save (~5-20ms)
      // — acceptable for a user-initiated action.
      //
      // The IDB write failure is non-fatal: the localStorage copy
      // is the source of truth and the next save will retry. The
      // caller does not see the failure (consistent with the
      // preset/strain fire-and-forget paths).
      try {
        await mirrorJournalToIdb(index)
      } catch {
        // IDB write failed (quota, private mode, disabled). The
        // localStorage copy is still the source of truth. The
        // next save will retry the mirror. We do NOT propagate
        // the error to the caller — the save itself succeeded
        // (localStorage has the new entry); only the durability
        // mirror failed.
      }

      return { success: true, id, filePath: `localStorage://${id}` }
    } catch (err) {
      return { success: false, error: lsQuotaError(err) }
    }
  },

  async loadJournalEntries(): Promise<{
    success: boolean
    error?: string
    entries: Record<string, unknown>[]
  }> {
    try {
      const index = readJson<{ id: string }[]>('journal-index', [])
      // If localStorage has no index, try the IDB fallback (Safari
      // eviction recovery). If IDB has a blob, rebuild localStorage
      // from it (one-time hydration) and proceed.
      if (index.length === 0) {
        const idbBlob = await idbGet<JournalIdbBlob>(IDB_KEY.journalEntries)
        if (idbBlob && Array.isArray(idbBlob.index) && idbBlob.entries) {
          // Re-hydrate localStorage from IDB so subsequent reads are
          // fast and we can survive a second Safari sweep before the
          // next save.
          saveJsonQuoted('journal-index', idbBlob.index)
          for (const meta of idbBlob.index) {
            const e = idbBlob.entries[meta.id]
            if (e) writeJson(`journal:${meta.id}`, e)
          }
          // Re-read so the rest of the function uses the same code
          // path as the localStorage hit.
          return {
            success: true,
            entries: sortEntriesByDateDesc(
              idbBlob.index
                .map(meta => idbBlob.entries[meta.id])
                .filter((e): e is Record<string, unknown> => e != null)
            ),
          }
        }
        return { success: true, entries: [] }
      }
      const entries: Record<string, unknown>[] = []
      for (const meta of index) {
        const entry = readJson<Record<string, unknown> | null>(
          `journal:${meta.id}`,
          null
        )
        if (entry) entries.push(entry)
      }
      return { success: true, entries: sortEntriesByDateDesc(entries) }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load journal entries'
      return { success: false, error: message, entries: [] }
    }
  },

  async deleteJournalEntry(
    id: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      localStorage.removeItem(lsKey(`journal:${id}`))
      // The localStorage index always has full meta (id/date/savedAt)
      // — saveJournalEntry writes the wide shape. We type the read
      // wide here so the filter result satisfies mirrorJournalToIdb.
      const index = readJson<{ id: string; date: string; savedAt: string }[]>(
        'journal-index',
        []
      )
      const newIndex = index.filter(e => e.id !== id)
      saveJsonQuoted('journal-index', newIndex)

      // Mirror the deletion to IndexedDB so the durability layer
      // doesn't accumulate orphans. Same read-modify-write pattern
      // as the save path — also awaited to keep localStorage and
      // IDB in lock-step (the read-modify-write is not safe to
      // interleave with a concurrent save).
      try {
        await mirrorJournalToIdb(newIndex)
      } catch {
        // IDB write failed — localStorage deletion is the source
        // of truth. The next save will reconcile.
      }

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete journal entry'
      return { success: false, error: message }
    }
  },

  async openExternal(url: string): Promise<{ success: boolean }> {
    try {
      // Validate the URL is http(s) before opening — never let an
      // attacker-controlled string use a javascript: URL.
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { success: false }
      }
      const w = window.open(url, '_blank', 'noopener,noreferrer')
      return { success: w != null }
    } catch {
      return { success: false }
    }
  },

  platform: 'web',
} as const

// Tiny helper because TS narrows JSON.stringify result — same shape as
// writeJson but kept separate to avoid the writeJson return-type noise
// showing up in call sites that don't care.
function saveJsonQuoted(key: string, value: unknown): void {
  writeJson(key, value)
}
