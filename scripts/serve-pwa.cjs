/**
 * serve-pwa.cjs — tiny static server for the ccc PWA bundle.
 *
 * Why this exists instead of `vite preview`:
 *  - vite preview looks for `index.html` as the directory index, but
 *    the web build emits `index.web.html` (so the source and output
 *    names don't collide with the Electron build's `index.html`).
 *  - vite preview doesn't do SPA fallback for unknown paths — the
 *    service worker will catch them after install, but the very first
 *    hit MUST land on the entry HTML or the SW will never register.
 *  - we need the service worker scope to be honored, so any path
 *    that doesn't match a real file should fall back to the entry
 *    HTML. That keeps the iOS "Add to Home Screen" install path
 *    robust even if the start_url ever changes.
 *
 * Tailscale Funnel proxies `https://<node>/ccc/...` → `http://127.0.0.1:8765/...`
 * after stripping the `/ccc` prefix. So this server sees requests
 * at the root, not under /ccc. The base path is encoded in the
 * emitted asset URLs (via Vite's `base: '/ccc/'`); the server's
 * job is to map the URL back to a file in `dist/`.
 *
 * Usage:
 *  - `pnpm serve:pwa` (from package.json scripts)
 *  - or `node scripts/serve-pwa.cjs`
 *
 * Override the port via the PORT env var. Default 8765.
 */

const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const DIST = path.resolve(__dirname, '..', 'dist')
const ENTRY = 'index.web.html'
const PORT = Number.parseInt(process.env.PORT ?? '8765', 10)
const HOST = process.env.HOST ?? '127.0.0.1'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

function mimeFor(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function safeJoin(root, urlPath) {
  // Decode percent-encoding, normalize, then make sure the resolved
  // path stays inside `root` — no path-traversal escapes.
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0])
  const normalized = path
    .normalize(decoded)
    .replace(/^([/\\])+/, '')
  const candidate = path.join(root, normalized)
  if (!candidate.startsWith(root)) return null
  return candidate
}

const server = http.createServer((req, res) => {
  const started = Date.now()

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' })
    res.end('Method Not Allowed')
    return
  }

  const url = req.url ?? '/'
  let filePath = safeJoin(DIST, url)
  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Bad Request')
    return
  }

  // SPA fallback: if the URL has no file extension and the path
  // doesn't exist as a file, serve the entry HTML. The PWA's
  // service worker will handle subsequent navigations, but the
  // install flow MUST land on the entry page.
  const ext = path.extname(filePath)
  let exists = fs.existsSync(filePath)
  let stat = exists ? fs.statSync(filePath) : null
  if ((!exists || (stat && stat.isDirectory())) && ext === '') {
    filePath = path.join(DIST, ENTRY)
    exists = fs.existsSync(filePath)
    stat = exists ? fs.statSync(filePath) : null
  }

  if (!exists || !stat || !stat.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
    console.warn(
      `[serve-pwa] 404 ${req.method} ${url} -> ${path.relative(DIST, filePath)}`
    )
    return
  }

  // Cache strategy:
  //  - HTML/manifest/sw.js/registerSW.js: never cache aggressively
  //    (cache-control: no-cache). PWA installs need the latest
  //    manifest and SW.
  //  - Hashed assets in /assets/: cache forever (1y). The hash in
  //    the filename busts the cache when content changes.
  //  - Icons / favicon / static PNGs: short cache (1h).
  const rel = path.relative(DIST, filePath).replace(/\\/g, '/')
  const isHashedAsset = rel.startsWith('assets/')
  const isHtml =
    rel === ENTRY || rel.endsWith('.webmanifest') || rel === 'sw.js' ||
    rel === 'registerSW.js' || rel.startsWith('workbox-')
  const headers = {
    'Content-Type': mimeFor(filePath),
    'Content-Length': stat.size,
    'X-Content-Type-Options': 'nosniff',
  }
  if (isHtml) {
    headers['Cache-Control'] = 'no-cache'
  } else if (isHashedAsset) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable'
  } else {
    headers['Cache-Control'] = 'public, max-age=3600'
  }

  res.writeHead(200, headers)
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  fs.createReadStream(filePath).pipe(res)

  const ms = Date.now() - started
  console.log(`[serve-pwa] 200 ${req.method} ${url} (${ms}ms)`)
})

server.listen(PORT, HOST, () => {
  console.log(`[serve-pwa] serving ${DIST} on http://${HOST}:${PORT}`)
  console.log('[serve-pwa] entry:', `http://${HOST}:${PORT}/`)
  console.log('[serve-pwa] PWA install URL:')
  console.log('[serve-pwa]   https://laptop.tail646a73.ts.net/ccc/  (via Tailscale Funnel)')
})

// Graceful shutdown — Tailscale Funnel will stop working without a
// live target, but a clean exit is friendlier to the OS than SIGKILL.
function shutdown(signal) {
  console.log(`[serve-pwa] ${signal} received, closing...`)
  server.close(() => process.exit(0))
  // Hard exit if close hangs (e.g. keep-alive socket).
  setTimeout(() => process.exit(0), 3000).unref()
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
