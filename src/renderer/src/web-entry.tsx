/**
 * Web entry point for the PWA build. Mirrors the Electron entry
 * (src/renderer/index.tsx) but imports the web platform bootstrap
 * first so `window.App` is set up before any React component mounts.
 *
 * The `lib/electron-router-dom` import inside `./routes` is aliased
 * (in vite.web.config.ts) to a web shim that uses react-router-dom
 * under the hood. The rest of the renderer source is unchanged.
 */

import React from 'react'
import ReactDom from 'react-dom/client'

import '@fontsource-variable/space-grotesk'

// Side-effect import: installs window.App shim if not in Electron.
import './platform/bootstrap'

import { AppRoutes } from '../routes'
import '../globals.css'

const root = document.querySelector('app')
if (!root) {
  throw new Error('ccc web entry: <app> element not found in index.html')
}

ReactDom.createRoot(root as HTMLElement).render(
  <React.StrictMode>
    <AppRoutes />
  </React.StrictMode>
)
