import { defineConfig, minimalPreset as preset } from '@vite-pwa/assets-generator/config'

/**
 * PWA asset generation config. The vite web build invokes
 * `pwa-assets-generate` automatically before bundling (when the
 * `pwaAssets.config: true` flag is set in vite.web.config.ts). The
 * generator uses the source SVG and produces the full set of PNG/ICO
 * icons referenced from the web manifest, plus the favicon.
 *
 * Source: src/resources/public/favicon.svg — a 64x64 leaf glyph on a
 * dark green rounded square. Reads at 192x192 and 512x512 without
 * rasterization artefacts because the source is vector.
 */
export default defineConfig({
  // The minimal preset generates the canonical PWA icon set:
  // 64x64, 192x192, 512x512, 512x512 maskable, plus favicon.ico.
  // The generator writes the outputs next to the source image unless
  // `imageResolver` / custom instructions are used. See:
  // https://github.com/vite-pwa/assets-generator
  //
  // Source lives in `src/renderer/public/` (the web build's publicDir)
  // so the generated PNGs/ICO end up there too — no copy step needed.
  images: ['src/renderer/public/favicon.svg'],
  preset,
  // Override the output SVG/PNG names so the public/ folder only has
  // the PWA-named files (the minimal preset already uses canonical
  // names like favicon, pwa-192x192, pwa-512x512, maskable-icon-*).
  resolveSvgName: () => 'favicon',
})
