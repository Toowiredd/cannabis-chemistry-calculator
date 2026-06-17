# CCC Electron E2E UI/UX Audit - 2026-06-18

## Scope

This pass started the CCC Electron development app, exercised the rendered UI like a first-time user, captured runtime screenshots, traced console output, and verified the Advanced Tools surface after the recent navigation work.

Primary evidence:

- `pnpm dev` launched the dev app on `http://localhost:4927/`.
- Runtime screenshots and JSON evidence are in `evidence/e2e-electron/`.
- Final clean console trace is `evidence/e2e-electron/final-console-smoke.json`.
- Current flow audit is `evidence/e2e-electron/current-renderer-flow-audit.json`.

Computer Use note: the bundled Computer Use bootstrap failed before app control with `Package subpath './dist/project/cua/sky_js/src/targets/windows/internal/computer_use_client_base.js' is not defined by "exports"`. I used Electron/Chromium automation as the fallback runtime evidence path.

## Actual First-Run Flow

1. The first visible state is the app shell with the First-Timer Guide modal on top.
2. The user must choose `I know what I am doing -- take me to the full app` to reach the main app immediately.
3. After dismissal, the default visible workspace is `Quick Batch`, not the Dashboard.
4. The top navigation exposes `Dashboard`, `Quick Batch`, `Decarb`, `Infusion`, `Dose`, `Methods`, `Advanced Tools`, `Knowledge`, and `Journal`.
5. `Advanced Tools` opens the new larger advanced surface and exposes `Fat Comparison`, `Concentrates`, `Strain Blending`, and `Cost Analysis`.

## Fixed During Audit

1. CSP blocked the SVG noise background data URI. Fixed by adding an explicit `img-src 'self' data:` policy in `src/renderer/index.html`.
2. Geist font URLs pointed to missing/invalid `/fonts/geist-*` files. Fixed by removing the dead `@font-face` declarations and using the already installed `Space Grotesk Variable` font.
3. Browser/dev-renderer access to Journal crashed the whole route when `window.App` was unavailable. Fixed by guarding Journal IPC calls and degrading to an empty local state instead of throwing.
4. The dev renderer requested `/favicon.ico` and logged a 404. Fixed by adding `src/resources/public/favicon.svg` and linking it from `index.html`.
5. Quick Batch generic `Next` controls were replaced with destination-aware labels and active-step semantics.
6. Destructive global `Escape` reset handlers were removed from Decarb, Infusion, and Dose.
7. Journal deletion now requires an explicit in-card confirmation before persisted storage is changed.
8. Icon-only controls and responsive calculator layouts were hardened across the main tabs.

Verification after fixes:

- `pnpm typecheck`: pass.
- `pnpm compile:app`: pass.
- `pnpm test`: pass, 30 files / 688 tests.
- Narrow viewport smoke at 390 x 700: no body/main horizontal overflow, no unnamed buttons, Decarb input preserved after Escape.
- Final runtime console trace: no CSP image errors, no font decode/OTS errors, no 404s.

## Remaining Findings

### High: Packaged/preview Electron launch still needs route verification

Direct compiled Electron launch through Playwright reached `chrome-error://chromewebdata/` and showed a blank black window. The dev app runs, but the production/preview route should be verified separately through `pnpm start` or packaged build launch before release.

Evidence: `evidence/e2e-electron/runtime-audit.json`, `01-launch.png`.

### Low: First-run hierarchy is still heavy

The First-Timer Guide dominates the first view. It is useful, but it suppresses the newer startup chooser/path heuristic and makes the first decision less direct.

Recommendation: decide whether the startup chooser or First-Timer Guide owns first-run. If both remain, show the tiny chooser first and make First-Timer Guide one of its options.

## Advanced Tools Reachability

Verified reachable after dismissing the guide:

- `Fat Comparison`: reachable and renders fat extraction cards.
- `Concentrates`: reachable and renders concentrate type, decarb notice, overrides, and result output.
- `Strain Blending`: reachable and renders strain inputs, target inputs, and blend results.
- `Cost Analysis`: reachable and renders material/cost inputs plus method comparison table.

## Recommended Next Fix Order

1. Verify and fix the production/preview Electron route blank-window behavior.
2. Reconcile First-Timer Guide vs startup chooser ownership of first-run.
