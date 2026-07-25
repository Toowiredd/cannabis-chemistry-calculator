// @vitest-environment node
/**
 * Main-process security test coverage for the F1.1 / F1.2 / F1.3
 * fixes shipped in commit 7e7c2f0.
 *
 * F1.1: `open-external` URL validation — the renderer can no longer
 *        smuggle `file:`, `javascript:`, `data:`, `vbscript:`, or
 *        unparseable URLs into the OS shell.
 * F1.2: Journal id regex `/^[A-Za-z0-9_-]{1,128}$/` — both the
 *        `save-journal-entry` and `delete-journal-entry` handlers
 *        reject path-traversal and over-long ids BEFORE they hit
 *        the filesystem.
 * F1.3: Explicit `webPreferences` flags — a future Electron
 *        default flip cannot silently downgrade the security
 *        posture. All four flags are asserted.
 *
 * The test imports the real `MainWindow()` factory from
 * `src/main/windows/main.ts` and stubs out its collaborators
 * (`electron`, the createWindow wrapper, the package.json alias,
 * the FS module) so the IPC handlers and the BrowserWindow
 * constructor payload can be inspected without booting a real
 * Electron process.
 *
 * The `node` test environment is required because `import 'electron'`
 * from jsdom attempts to load a browser-shaped API surface that
 * conflicts with Electron's main-process exports.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE importing the module under test so vi.mock
// hoists them above the `import` statements.
// ---------------------------------------------------------------------------

// Captures for assertions.
const ipcHandlers = new Map<
  string,
  (event: unknown, payload: unknown) => unknown
>()
const ipcListeners = new Map<
  string,
  (event: unknown, payload?: unknown) => void
>()
let capturedCreateWindowArg: {
  webPreferences?: Record<string, unknown>
} | null = null

vi.mock('electron', () => {
  const ipcMain = {
    handle: vi.fn(
      (channel: string, fn: (event: unknown, payload: unknown) => unknown) => {
        ipcHandlers.set(channel, fn)
      }
    ),
    on: vi.fn(
      (channel: string, fn: (event: unknown, payload?: unknown) => void) => {
        ipcListeners.set(channel, fn)
      }
    ),
  }
  return {
    app: {
      getPath: vi.fn((name: string) =>
        name === 'userData' ? '/tmp/ccc-test-userdata' : `/tmp/ccc-test-${name}`
      ),
    },
    BrowserWindow: vi.fn().mockImplementation((opts: unknown) => ({
      webPreferences: (opts as { webPreferences?: unknown }).webPreferences,
      webContents: {
        on: vi.fn(),
        openDevTools: vi.fn(),
        once: vi.fn(),
        reload: vi.fn(),
      },
      on: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
      isMaximized: vi.fn().mockReturnValue(false),
      minimize: vi.fn(),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      close: vi.fn(),
      show: vi.fn(),
    })),
    ipcMain,
    dialog: {
      showSaveDialog: vi.fn(),
      showOpenDialog: vi.fn(),
    },
    clipboard: {
      writeText: vi.fn(),
    },
    shell: {
      // Tests assert on this — defaults to a successful open so the
      // "accepts" cases can rely on the result of the handler. Individual
      // tests override per-case when needed.
      openExternal: vi.fn().mockResolvedValue(true),
    },
  }
})

vi.mock('lib/electron-app/factories/windows/create', () => ({
  createWindow: vi.fn((opts: { webPreferences?: Record<string, unknown> }) => {
    capturedCreateWindowArg = opts
    return {
      webPreferences: opts.webPreferences,
      webContents: { on: vi.fn(), once: vi.fn() },
      on: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
      isMaximized: vi.fn().mockReturnValue(false),
      show: vi.fn(),
    }
  }),
}))

vi.mock('lib/electron-router-dom', () => ({
  registerRoute: vi.fn(),
}))

vi.mock('~/package.json', () => ({
  default: { displayName: 'Cannabis Chemistry Calculator', version: '1.0.0' },
  displayName: 'Cannabis Chemistry Calculator',
  version: '1.0.0',
}))

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  // existsSync returns false so the delete-journal-entry happy path
  // never tries to unlink (the source code uses CJS `require('node:fs')`
  // which vitest does not always intercept, so we skip the syscall by
  // pretending the file isn't there). The regex check runs BEFORE the
  // unlink, so this test still proves the id validator accepts a valid
  // id and reaches the success branch.
  existsSync: vi.fn().mockReturnValue(false),
  readdirSync: vi.fn().mockReturnValue([]),
  unlinkSync: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

// eslint-disable-next-line import/first -- must come after vi.mock
import { MainWindow } from '~/src/main/windows/main'
// eslint-disable-next-line import/first
import { shell } from 'electron'

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await MainWindow()
})

afterAll(() => {
  vi.restoreAllMocks()
})

function callHandler<T = unknown>(
  channel: string,
  payload: unknown
): Promise<T> {
  const fn = ipcHandlers.get(channel)
  if (!fn) {
    throw new Error(`No handler registered for channel: ${channel}`)
  }
  return Promise.resolve(fn({}, payload)) as Promise<T>
}

// ---------------------------------------------------------------------------
// F1.3 — Explicit webPreferences flags must be present and correct.
// ---------------------------------------------------------------------------

describe('F1.3 — BrowserWindow webPreferences', () => {
  it('passes an explicit webPreferences object to createWindow', () => {
    expect(capturedCreateWindowArg).not.toBeNull()
    expect(capturedCreateWindowArg?.webPreferences).toBeDefined()
  })

  it('sets contextIsolation: true (no node in renderer)', () => {
    expect(capturedCreateWindowArg?.webPreferences?.contextIsolation).toBe(true)
  })

  it('sets nodeIntegration: false (no require in renderer)', () => {
    expect(capturedCreateWindowArg?.webPreferences?.nodeIntegration).toBe(false)
  })

  it('sets sandbox: false (preload uses node, but isolation is on)', () => {
    expect(capturedCreateWindowArg?.webPreferences?.sandbox).toBe(false)
  })

  it('sets webSecurity: true (no CORS bypass)', () => {
    expect(capturedCreateWindowArg?.webPreferences?.webSecurity).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// F1.1 — open-external URL protocol allowlist.
// ---------------------------------------------------------------------------

describe('F1.1 — open-external protocol allowlist', () => {
  it('rejects file:// URLs (would leak local files)', async () => {
    vi.mocked(shell.openExternal).mockClear()
    const result = await callHandler<{ success: boolean; error?: string }>(
      'open-external',
      'file:///etc/passwd'
    )
    expect(result.success).toBe(false)
    expect(shell.openExternal).not.toHaveBeenCalled()
  })

  it('rejects javascript: URLs (XSS via shell)', async () => {
    vi.mocked(shell.openExternal).mockClear()
    const result = await callHandler<{ success: boolean; error?: string }>(
      'open-external',
      'javascript:alert(1)'
    )
    expect(result.success).toBe(false)
    expect(shell.openExternal).not.toHaveBeenCalled()
  })

  it('rejects data: URLs (no protocol allowlist slot)', async () => {
    vi.mocked(shell.openExternal).mockClear()
    const result = await callHandler<{ success: boolean; error?: string }>(
      'open-external',
      'data:text/html,<script>alert(1)</script>'
    )
    expect(result.success).toBe(false)
    expect(shell.openExternal).not.toHaveBeenCalled()
  })

  it('rejects vbscript: URLs (Windows-only XSS vector)', async () => {
    vi.mocked(shell.openExternal).mockClear()
    const result = await callHandler<{ success: boolean; error?: string }>(
      'open-external',
      'vbscript:msgbox(1)'
    )
    expect(result.success).toBe(false)
    expect(shell.openExternal).not.toHaveBeenCalled()
  })

  it('rejects unparseable URLs', async () => {
    vi.mocked(shell.openExternal).mockClear()
    const result = await callHandler<{ success: boolean; error?: string }>(
      'open-external',
      'not a url at all'
    )
    expect(result.success).toBe(false)
    expect(shell.openExternal).not.toHaveBeenCalled()
  })

  it('accepts http: URLs and delegates to shell.openExternal', async () => {
    vi.mocked(shell.openExternal).mockClear()
    const result = await callHandler<{ success: boolean }>(
      'open-external',
      'http://example.com'
    )
    expect(result.success).toBe(true)
    expect(shell.openExternal).toHaveBeenCalledWith('http://example.com/')
  })

  it('accepts https: URLs and delegates to shell.openExternal', async () => {
    vi.mocked(shell.openExternal).mockClear()
    const result = await callHandler<{ success: boolean }>(
      'open-external',
      'https://example.com/page?x=1'
    )
    expect(result.success).toBe(true)
    expect(shell.openExternal).toHaveBeenCalledWith(
      'https://example.com/page?x=1'
    )
  })

  it('accepts mailto: URLs and delegates to shell.openExternal', async () => {
    vi.mocked(shell.openExternal).mockClear()
    const result = await callHandler<{ success: boolean }>(
      'open-external',
      'mailto:user@example.com'
    )
    expect(result.success).toBe(true)
    expect(shell.openExternal).toHaveBeenCalledWith('mailto:user@example.com')
  })
})

// ---------------------------------------------------------------------------
// F1.2 — Journal id regex.
// ---------------------------------------------------------------------------

describe('F1.2 — save-journal-entry id validation', () => {
  it('accepts a valid id like entry_abc123', async () => {
    const result = await callHandler<{ success: boolean; id?: string }>(
      'save-journal-entry',
      { id: 'entry_abc123', title: 'ok' }
    )
    expect(result.success).toBe(true)
    expect(result.id).toBe('entry_abc123')
  })

  it('rejects ids containing a forward slash (path traversal)', async () => {
    const result = await callHandler<{ success: boolean; error?: string }>(
      'save-journal-entry',
      { id: '../etc/passwd', title: 'evil' }
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid id')
  })

  it('rejects ids containing a backslash (Windows path separator)', async () => {
    const result = await callHandler<{ success: boolean; error?: string }>(
      'save-journal-entry',
      { id: 'foo\\bar', title: 'evil' }
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid id')
  })

  it('rejects ids containing .. (parent-dir escape)', async () => {
    const result = await callHandler<{ success: boolean; error?: string }>(
      'save-journal-entry',
      { id: 'a..b', title: 'evil' }
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid id')
  })

  it('rejects ids containing control characters', async () => {
    const result = await callHandler<{ success: boolean; error?: string }>(
      'save-journal-entry',
      { id: 'foo\u0000bar', title: 'evil' }
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid id')
  })

  it('rejects ids with leading dots (hidden files / relative paths)', async () => {
    const result = await callHandler<{ success: boolean; error?: string }>(
      'save-journal-entry',
      { id: '.hidden', title: 'evil' }
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid id')
  })

  it('rejects ids over 128 characters (length cap)', async () => {
    const longId = 'a'.repeat(129)
    const result = await callHandler<{ success: boolean; error?: string }>(
      'save-journal-entry',
      { id: longId, title: 'evil' }
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid id')
  })

  it('accepts ids at exactly 128 characters (boundary)', async () => {
    const boundaryId = 'a'.repeat(128)
    const result = await callHandler<{ success: boolean; id?: string }>(
      'save-journal-entry',
      { id: boundaryId, title: 'ok' }
    )
    expect(result.success).toBe(true)
    expect(result.id).toBe(boundaryId)
  })
})

describe('F1.2 — delete-journal-entry id validation', () => {
  it('rejects ids containing a forward slash', async () => {
    const result = await callHandler<{ success: boolean; error?: string }>(
      'delete-journal-entry',
      '../etc/passwd'
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid id')
  })

  it('rejects ids containing a backslash', async () => {
    const result = await callHandler<{ success: boolean; error?: string }>(
      'delete-journal-entry',
      'foo\\bar'
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid id')
  })

  it('rejects ids containing ..', async () => {
    const result = await callHandler<{ success: boolean; error?: string }>(
      'delete-journal-entry',
      'a..b'
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid id')
  })

  it('rejects ids containing control characters', async () => {
    const result = await callHandler<{ success: boolean; error?: string }>(
      'delete-journal-entry',
      'foo\u0007bar'
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid id')
  })

  it('rejects ids with leading dots', async () => {
    const result = await callHandler<{ success: boolean; error?: string }>(
      'delete-journal-entry',
      '.hidden'
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid id')
  })

  it('rejects ids over 128 characters', async () => {
    const longId = 'a'.repeat(129)
    const result = await callHandler<{ success: boolean; error?: string }>(
      'delete-journal-entry',
      longId
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid id')
  })

  it('accepts a valid id and reports success', async () => {
    const result = await callHandler<{ success: boolean; error?: string }>(
      'delete-journal-entry',
      'entry_abc123'
    )
    if (!result.success) {
      // Surface the handler's error so a regression is debuggable
      // instead of a silent "expected false to be true".
      throw new Error(
        `delete-journal-entry failed: ${result.error ?? '<no error field>'}`
      )
    }
    expect(result.success).toBe(true)
  })
})
