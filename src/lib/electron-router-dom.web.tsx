/**
 * Web shim for `lib/electron-router-dom`. The web build aliases this
 * path to override the Electron-only implementation (see
 * vite.web.config.ts `resolve.alias`).
 *
 * The shim exposes the same surface (Router / registerRoute / settings)
 * the renderer's `AppRoutes` consumes, but uses react-router-dom under
 * the hood so the SPA works in a browser tab.
 *
 * `Router` here renders the `main` route element inside a real
 * <BrowserRouter> + <Routes> pair. The Electron implementation of
 * Router uses hash-based memory routing for child windows — the web
 * build doesn't need that.
 */

import type { ReactElement } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

interface RouterProps {
  main: ReactElement
}

export function Router({ main }: RouterProps): ReactElement {
  // basename tells React Router that the SPA is mounted under
  // /ccc/ on this host. Without it, `<Route path="/" />` only
  // matches the root, not `/ccc/`, and the iPad's address bar
  // would show `/ccc/` while the router would say "no routes
  // matched" and render nothing. The basename also makes <Link>
  // and useNavigate() prepend `/ccc` automatically.
  //
  // Why /ccc/ specifically: the web bundle is served at
  // https://laptop.tail646a73.ts.net/ccc/ via Tailscale Funnel.
  // The Vite build's `base` is also `/ccc/`, so the dist's
  // emitted asset URLs all live under that prefix. Keep basename
  // and `base` in lockstep.
  return (
    <BrowserRouter basename="/ccc/">
      <Routes>{main}</Routes>
    </BrowserRouter>
  )
}

export function registerRoute(): void {
  // No-op: route registration is an Electron IPC concern. Kept as a
  // stub so callsites don't need platform conditionals.
}

export const settings = {
  port: 4927,
}
