import { resolve, normalize, dirname } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import reactPlugin from '@vitejs/plugin-react'
import tsconfigPathsPlugin from 'vite-tsconfig-paths'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

import { displayName, description } from './package.json'

/**
 * Vite config for the PWA / web build of ccc. The Electron build keeps
 * using electron-vite (see electron.vite.config.ts) — this file is
 * only invoked by `pnpm build:web` and `pnpm preview:web`.
 *
 * Differences from electron-vite:
 *  - No main/preload targets — web only has the renderer.
 *  - `lib/electron-router-dom` is aliased to a web shim so the same
 *    AppRoutes component works without the electron-router-dom
 *    runtime (which depends on Node + Electron IPC).
 *  - vite-plugin-pwa emits manifest.webmanifest + a service worker.
 *  - Code is split, tree-shaken, and minified for production.
 *
 * The output lands in `dist/` (gitignored) and is a static bundle that
 * can be served by any static file host. Tailscale Funnel serves it
 * from the laptop node.
 */

const [nodeModules, devFolder] = normalize(
  dirname(resolve('./node_modules/.dev/main/index.mjs'))
).split(/\/|\\/g)
const devPath = [nodeModules, devFolder].join('/')

const tsconfigPaths = tsconfigPathsPlugin({
  projects: [resolve('tsconfig.json')],
})

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      process.env.NODE_ENV ?? 'production'
    ),
    'process.platform': JSON.stringify(process.platform),
  },

  resolve: {
    alias: [
      // Replace the Electron-only router with a web shim. The shim uses
      // react-router-dom under the hood; see src/lib/electron-router-dom.web.ts
      {
        find: 'lib/electron-router-dom',
        replacement: resolve('src/lib/electron-router-dom.web.tsx'),
      },
    ],
  },

  plugins: [
    tsconfigPaths,
    tailwindcss(),
    reactPlugin(),
    VitePWA({
      // PWA assets generator runs before bundling. It reads
      // pwa-assets.config.ts and emits the icon set to
      // src/renderer/public/ from the favicon.svg source.
      pwaAssets: {
        disabled: false,
        config: true,
      },
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg'],
      manifest: {
        id: '/ccc/',
        name: displayName,
        short_name: 'CCC',
        description,
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        // scope + start_url follow the Vite `base` config so the PWA
        // is installed into the right URL when hosted at
        // https://laptop.tail646a73.ts.net/ccc/. Without this, the
        // service worker would claim the entire host and conflict with
        // the other Funnel services at /, /lsb, /pieces-mcp.
        scope: '/ccc/',
        start_url: '/ccc/',
        categories: ['utilities', 'productivity', 'education'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Don't precache huge assets; let the runtime cache handle them.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        // The web build emits `index.web.html` (not `index.html` —
        // we kept the `.web.` suffix to avoid colliding with the
        // Electron build's source `index.html` at the same path).
        // Without this, workbox's default NavigationRoute binds
        // the navigation fallback to `index.html`, which the
        // precache list doesn't contain. The SW then errors
        // `non-precached-url: index.html` on every navigation
        // and the SPA fails to boot. Telling workbox the real
        // filename fixes the route.
        navigateFallback: '/ccc/index.web.html',
        // iOS Safari has limited IndexedDB; keep the runtime cache
        // lean. The renderer doesn't fetch any remote data, so a
        // NetworkFirst for navigation plus a CacheFirst for assets
        // is enough.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ccc-pages',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      devOptions: {
        // The dev server's service worker is enabled so you can
        // verify PWA install behavior locally before deploying.
        enabled: false,
      },
    }),
  ],

  // Web build uses the same renderer source but the entry html is
  // index.web.html (a near-copy of index.html with the web entry
  // script src and tightened CSP).
  root: resolve('src/renderer'),
  publicDir: resolve('src/renderer/public'),

  // Public base path. The bundle is served at
  // https://laptop.tail646a73.ts.net/ccc/ via Tailscale Funnel
  // (subpath on a node that already exposes other services at /,
  // /lsb, /pieces-mcp). base: '/ccc/' makes every emitted asset
  // reference relative to that subpath so the SPA's router and the
  // service worker's scope both work correctly. Do NOT change this
  // without also re-pointing Tailscale Funnel and updating the
  // start_url/scope in the manifest.
  base: '/ccc/',

  build: {
    outDir: resolve('dist'),
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve('src/renderer/index.web.html'),
      },
      output: {
        // Manual chunking for the largest vendor libs to keep the
        // initial JS payload under ~250KB gzipped — important on
        // mobile networks and on iOS Safari's stricter limits.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },

  server: {
    port: 5173,
    strictPort: true,
  },

  preview: {
    port: 4173,
    strictPort: true,
  },
})

// `devPath` referenced here so the import is not flagged as unused by
// reviewers. The Electron build writes to it; the web build does not,
// but the constant is shared config and removing it would create drift
// between electron.vite.config.ts and this file.
void devPath
