import ReactDom from 'react-dom/client'
import React from 'react'

import '@fontsource-variable/space-grotesk'

// Side-effect import: installs the `window.App` shim if not in Electron.
// In Electron, the preload has already set `window.App` synchronously, so
// `ensureAppShim()` is a no-op. The web entry (`src/web-entry.tsx`) does the
// same import (relative to `src/`, where the platform module lives); keeping
// the two entries symmetric means tests can use either path and still get the
// shim via the same code production uses.
import './src/platform/bootstrap'

import { AppRoutes } from './routes'

import './globals.css'

ReactDom.createRoot(document.querySelector('app') as HTMLElement).render(
  <React.StrictMode>
    <AppRoutes />
  </React.StrictMode>
)
