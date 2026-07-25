#!/usr/bin/env node
/**
 * PWA install validation — fetches every required resource, checks
 * the manifest is well-formed, the HTML wires up the manifest + SW,
 * the service worker file is real, and every icon referenced from
 * the manifest returns 200. Run after the PWA server is up and the
 * Funnel route is live. Exits non-zero on any failure.
 *
 * Usage: node scripts/validate-pwa.cjs
 *   (override URL with PWA_URL env var, default
 *    https://laptop.tail646a73.ts.net/ccc/)
 */

const https = require('node:https')
const http = require('node:http')
const fs = require('node:fs')

const PWA_URL = (process.env.PWA_URL || 'https://laptop.tail646a73.ts.net/ccc/').replace(/\/$/, '')

// Refuse to run if the user has globally disabled TLS verification — the
// validator fetches manifest + SW + icons, and a MITM-safe posture is the
// point. Set NODE_TLS_REJECT_UNAUTHORIZED=0 in a parent shell and you would
// otherwise silently bypass cert checks for every Node child.
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  console.error(
    'validate-pwa: NODE_TLS_REJECT_UNAUTHORIZED=0 is set; refusing to run ' +
      'with cert verification disabled. Unset the env var to validate.'
  )
  process.exit(2)
}

// Build an https.Agent that honors NODE_EXTRA_CA_CERTS (e.g. the
// Tailscale root CA) and always requires a valid cert. Without the env
// var, we use the OS trust store (rejectUnauthorized:true, no ca).
const caPath = process.env.NODE_EXTRA_CA_CERTS
let HTTP_AGENT
if (caPath) {
  let ca
  try {
    ca = fs.readFileSync(caPath)
  } catch (err) {
    console.error(
      `validate-pwa: failed to read NODE_EXTRA_CA_CERTS=${caPath}: ${err.message}`
    )
    process.exit(2)
  }
  HTTP_AGENT = new https.Agent({ ca, rejectUnauthorized: true })
} else {
  HTTP_AGENT = new https.Agent({ rejectUnauthorized: true })
}

const errors = []
const warnings = []
const checks = []

function track(name, ok, detail) {
  checks.push({ name, ok, detail })
  if (!ok) errors.push(`${name}: ${detail}`)
}

function warn(name, detail) {
  warnings.push(`${name}: ${detail}`)
}

function fetch(url, agent = HTTP_AGENT) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'GET',
        agent,
        headers: { 'User-Agent': 'ccc-pwa-validator/1.0' },
      },
      res => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf-8'),
          })
        )
      }
    )
    req.on('error', reject)
    req.setTimeout(15000, () => req.destroy(new Error('timeout')))
    req.end()
  })
}

function absoluteUrl(maybeRelative) {
  return new URL(maybeRelative, PWA_URL + '/').toString()
}

async function main() {
  console.log(`Validating PWA at ${PWA_URL}\n`)

  // 1. Entry HTML
  const entryRes = await fetch(PWA_URL + '/')
  track(
    'entry HTML 200',
    entryRes.status === 200,
    `got ${entryRes.status}`
  )
  const html = entryRes.body

  // 2. Manifest link
  const manifestMatch = html.match(/<link[^>]+rel="manifest"[^>]+href="([^"]+)"/)
  track(
    'entry HTML has manifest link',
    !!manifestMatch,
    manifestMatch ? `href=${manifestMatch[1]}` : 'no <link rel="manifest"> found'
  )
  if (!manifestMatch) {
    finish()
    return
  }
  const manifestUrl = absoluteUrl(manifestMatch[1])

  // 3. Apple touch icon (iOS uses this for the home screen)
  const appleMatch = html.match(/<link[^>]+rel="apple-touch-icon"[^>]+href="([^"]+)"/)
  if (appleMatch) {
    const r = await fetch(absoluteUrl(appleMatch[1]))
    track(
      'apple-touch-icon 200',
      r.status === 200,
      `${appleMatch[1]} -> ${r.status}`
    )
  } else {
    warn('apple-touch-icon', 'no apple-touch-icon link in HTML (iOS will fall back to the first manifest icon)')
  }

  // 4. Service worker registration script
  const swScriptMatch = html.match(/<script[^>]+src="[^"]*registerSW\.js"/)
  track(
    'entry HTML registers service worker',
    !!swScriptMatch,
    swScriptMatch ? 'registerSW.js present' : 'no registerSW.js script tag'
  )

  // 5. Theme color (status bar tinting on iOS/Android)
  const themeColor = html.match(/<meta[^>]+name="theme-color"[^>]+content="([^"]+)"/)
  track(
    'theme-color meta present',
    !!themeColor,
    themeColor ? `color=${themeColor[1]}` : 'no theme-color meta'
  )

  // 6. apple-mobile-web-app-capable (the older iOS PWA signal)
  const capable = html.match(/<meta[^>]+name="apple-mobile-web-app-capable"/)
  track(
    'apple-mobile-web-app-capable meta present',
    !!capable,
    capable ? 'present' : 'missing (iOS may still install but the home-screen icon will use the system default behavior)'
  )

  // 7. Fetch manifest
  const manifestRes = await fetch(manifestUrl)
  track(
    'manifest 200',
    manifestRes.status === 200,
    `got ${manifestRes.status}`
  )
  const manifest = JSON.parse(manifestRes.body)

  // 8. Required manifest fields for PWA install
  const required = ['name', 'short_name', 'start_url', 'display', 'icons']
  for (const field of required) {
    track(
      `manifest.${field}`,
      !!manifest[field] && (Array.isArray(manifest[field]) ? manifest[field].length > 0 : true),
      manifest[field] ? 'present' : 'missing'
    )
  }

  // 9. start_url is reachable
  if (manifest.start_url) {
    const r = await fetch(absoluteUrl(manifest.start_url))
    track(
      'manifest.start_url reachable',
      r.status === 200,
      `${manifest.start_url} -> ${r.status}`
    )
  }

  // 10. display=standalone (iOS uses this to hide Safari chrome)
  track(
    'manifest.display=standalone',
    manifest.display === 'standalone',
    `display=${manifest.display}`
  )

  // 11. Icons
  if (Array.isArray(manifest.icons)) {
    for (const icon of manifest.icons) {
      const r = await fetch(absoluteUrl(icon.src))
      track(
        `icon ${icon.sizes} ${icon.purpose || 'any'}`,
        r.status === 200,
        `${icon.src} -> ${r.status}`
      )
    }
  }

  // 12. Service worker file
  // Use a relative path so the result is `<PWA_URL>/sw.js` which
  // is `/ccc/sw.js` — the /ccc subpath is the Funnel route. Using
  // a leading slash would resolve to the host root and miss the
  // route.
  const swUrl = absoluteUrl('sw.js')
  const swRes = await fetch(swUrl)
  track(
    'sw.js 200',
    swRes.status === 200,
    `got ${swRes.status}`
  )
  // The service worker file should reference the workbox runtime and
  // a precache list. Just sanity-check it's non-trivial.
  track(
    'sw.js non-empty and references precache',
    swRes.body.length > 500 && /precache|self\.__WB_MANIFEST|workbox/i.test(swRes.body),
    `len=${swRes.body.length}`
  )

  // 13. scope is consistent with the path
  if (manifest.scope && manifest.start_url) {
    track(
      'manifest.scope starts with manifest.start_url',
      manifest.start_url.startsWith(manifest.scope) || manifest.scope.startsWith(manifest.start_url) || manifest.start_url === manifest.scope + 'index.html',
      `scope=${manifest.scope} start_url=${manifest.start_url}`
    )
  }

  finish()
}

function finish() {
  console.log('\n--- checks ---')
  for (const c of checks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}  ${c.ok ? '' : '(' + c.detail + ')'}`)
  }
  if (warnings.length) {
    console.log('\n--- warnings ---')
    for (const w of warnings) console.log(`  ⚠ ${w}`)
  }
  console.log(
    `\n${checks.filter(c => c.ok).length}/${checks.length} passed, ${errors.length} failed, ${warnings.length} warnings`
  )
  process.exit(errors.length ? 1 : 0)
}

main().catch(err => {
  console.error('validator error:', err)
  process.exit(2)
})
