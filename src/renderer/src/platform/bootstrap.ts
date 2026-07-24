/**
 * Platform bootstrap. Runs as a side effect when imported by the renderer
 * entry point. In Electron, the preload has already set `window.App` via
 * contextBridge before this module loads, so we do nothing. In a plain
 * browser context (PWA build, dev server, tests), we install the web
 * shim so every existing `window.App.*` callsite works without change.
 *
 * Why a separate module: keeps the env-detection decision in one place
 * and lets the web entry point import it before mounting React. The
 * electron entry point also imports it (cheap — `window.App` is already
 * set by preload) which keeps the two entry points symmetric and means
 * tests get the shim via the same path production uses.
 *
 * Note on types: `Window.App` is declared in `src/renderer/src/global.d.ts`
 * — the source of truth shared with the Electron preload. We deliberately
 * do NOT redeclare it here; doing so creates a TS2687 modifier conflict
 * with the preload's `interface Window { App: ... }` block. The shim is
 * assigned via a cast because the shim's `platform: 'web'` is narrower
 * than the preload's `NodeJS.Platform` literal union, but the runtime
 * shape is identical (same methods, same return types) so the cast is
 * safe.
 */

import { webApp } from './web-shim'

export function isElectronContext(): boolean {
  // The preload exposes `window.App` synchronously before the renderer
  // scripts run. Checking for the preload-injected value is more
  // reliable than UA-sniffing `navigator.userAgent` (some test setups
  // have a UA string but no preload).
  return (
    typeof window !== 'undefined' &&
    typeof window.App === 'object' &&
    window.App !== null &&
    typeof window.App.exportReport === 'function'
  )
}

export function ensureAppShim(): void {
  if (typeof window === 'undefined') return
  if (isElectronContext()) return
  // Cast: the shim's `platform` is the literal 'web', which is wider
  // than NodeJS.Platform. The Window.App type from global.d.ts uses
  // `string` for platform, so this is assignment-compatible at the
  // Window.App interface level, but the const-asserted `webApp` object
  // has a literal type. The cast bridges the difference.
  ;(window as unknown as { App: typeof webApp }).App = webApp
}

// Run on import. If we're in a context where window.App already exists
// (Electron), this is a no-op. In a browser, this installs the shim.
ensureAppShim()
