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
 * Storage strategy:
 *   - localStorage for small JSON blobs (presets, strains, journal index)
 *   - Blob URLs for downloads (no write access to a real filesystem)
 *   - navigator.clipboard for copy
 *   - window.open for external links (noopener)
 *
 * Persistence caveat (call out in the PWA UI later if needed):
 *   - localStorage survives reloads on the same origin but is per-origin
 *     and per-browser-profile. iOS Safari has historically evicted
 *     localStorage for PWAs under storage pressure; IndexedDB would be
 *     more durable, but localStorage matches the desktop semantics
 *     (single-user, single-device) closely enough for a first pass.
 *   - Journal entries can grow unbounded; if a user hits the ~5MB
 *     localStorage quota, savePreset/saveJournalEntry will return
 *     { success: false, error: 'Storage quota exceeded' }.
 */

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
      writeJson('strains', data)
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
      const strains = readJson<unknown[]>('strains', [])
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
      const entries: Record<string, unknown>[] = []
      for (const meta of index) {
        const entry = readJson<Record<string, unknown> | null>(
          `journal:${meta.id}`,
          null
        )
        if (entry) entries.push(entry)
      }
      // Newest first
      entries.sort((a, b) => {
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
      return { success: true, entries }
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
      const index = readJson<{ id: string }[]>('journal-index', [])
      saveJsonQuoted(
        'journal-index',
        index.filter(e => e.id !== id)
      )
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
