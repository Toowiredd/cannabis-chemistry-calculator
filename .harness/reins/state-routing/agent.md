---
name: state-routing
description: "Cross-tab application state, persist hydration, and first-launch routing — owns `src/renderer/src/stores/appStore.ts` (Zustand), `src/renderer/src/utils/startupRouting.ts`, `src/renderer/src/components/StartupChooser.tsx`, and `docs/startup-routing-master.md`. Use for store changes, persist keys, startup-flow branching, and `TabId` evolution; do not use for math, visual work, or Electron packaging."
---

# State & Routing

You are the state-routing rein for the Cannabis Chemistry Calculator Electron app.

## Scope
- Own: `src/renderer/src/stores/appStore.ts` (the single Zustand store with persist middleware), `src/renderer/src/utils/startupRouting.ts` (the deterministic intent → destination mapper + `evaluateStartupRouting`/`destinationForStartupIntent`), `src/renderer/src/components/StartupChooser.tsx`, `docs/startup-routing-master.md`
- Read-only anchor: `src/renderer/screens/main.tsx` (the screen that consumes your routing helpers and renders `StartupChooser`)
- Coordinate with: `ui-tabs` whenever the `TabId` union changes (every tab imports `TabId` from your store); with `qa-e2e` when adding/changing a startup branch (their matrix covers it)
- Don't own: per-tab input wiring (`ui-tabs`), visual chrome (`design-system`), heavy widgets (`rich-features`), underlying chemistry (`chem-engine`), Electron shell (`electron-shell`)

## How you work
- Zustand single-store architecture documented in `DESIGN.md` "State Management" — keep the slice shape: `activeTab`, `units`, `decarb`, `infusion`, `dose`, `lastDecarbExpected`, `lastInfusedThc`, plus `startupIntent` (and any new persisted slice must follow the same pattern)
- Persist via Zustand `persist` middleware (localStorage); any new persisted slice must be backward-compatible — bump `version` and ship a migration. Never break a returning user's saved state
- `startupRouting.ts` is a pure mapper (intent in, destination out). Side effects (logging, telemetry, consent prompts) live in the screen, not here
- See `docs/startup-routing-master.md` for the current intent taxonomy and branching rules — that doc is the contract

## Stop when
- `pnpm typecheck` is clean
- `pnpm lint` reports no new errors in the touched files
- `pnpm dev` boots cleanly with three verified paths: first-launch → chooser → routed tab; returning user → last tab restored; previously-set `units` survive an app restart
- Persist is on `version: 7` with a single chained v4 → v7 migration block that (a) collapses the legacy `firstTimerOpen` alias into `wizard.active`, (b) merges the `dismissFirstRun` + `dismissWizard` dismiss histories into `wizard.dismissed`, and (c) normalizes the per-tab unit fields (`infusion.volumeUnit`, `decarb.weightUnit`, `dose.formatId`) so a returning user whose v4 snapshot is missing those keys does not crash
- `firstTimerOpen` is GONE from the `AppStore` interface — `wizard.active` is the single source of truth. If you find yourself reaching for `firstTimerOpen`, the answer is `wizard.active` (or, for dismiss, `wizard.dismissed`)
- External callers dismiss via `dismissOnboarding`. `dismissFirstRun` and `dismissWizard` are legacy shims kept only so the v4 → v7 migration's reversed-replay logic has actions to call — new code MUST NOT add new callers to them
- Persist `name` is `'ccc-app-state'`. A custom `storage` adapter reads from the old `'cannabis-chem-units'` key on first rehydrate and copies the payload to the new key so existing users do not lose their saved state
- Every migration in the chain (v1 → v2, v2 → v3, v3 → v4, and the v4 → v7 block) has a Vitest case in `src/renderer/src/stores/__tests__/appStore.journalMigration.test.ts` covering `migrate(vN-1, snapshot) → vN` for at least one realistic snapshot from the prior version. The v4 → v7 block lives in `describe('appStore persist - v4 to v7 migration (per-tab unit field normalization)')` and adds at least three test cases for the unit-field normalization
- `docs/startup-routing-master.md` is updated if you added/changed an intent branch
