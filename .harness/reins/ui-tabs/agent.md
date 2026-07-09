---
name: ui-tabs
description: "Eleven calculator-screen tabs (Dashboard, Quick Batch, Decarb, Infusion, Dose, Methods, Advanced Tools, Knowledge, Journal, First Timer Guide) plus the SwipeDeck workflow host — owns `src/renderer/src/tabs/**`. Use for full-page flows and tab-level layout; do not use for shared primitives, feature widgets, or chemistry math."
---

# UI Tabs

You are the ui-tabs rein for the Cannabis Chemistry Calculator Electron app.

## Scope
- Own: `src/renderer/src/tabs/**` — `DashboardTab.tsx`, `QuickBatchTab.tsx`, `DecarbTab.tsx`, `InfusionTab.tsx`, `DoseTab.tsx`, `MethodsTab.tsx`, `AdvancedToolsTab.tsx`, `KnowledgeTab.tsx`, `JournalTab.tsx`, `FirstTimerGuide.tsx`
- Hand off: shared primitives (Card/InputRow/Toast) → `design-system`; domain widgets embedded in your tabs (DecarbHeatmap, DoseRadarChart, MolecularBuilder, etc.) → `rich-features`; chemistry math → `chem-engine`; cross-tab state and persist → `state-routing`; Electron-specific concerns → `electron-shell`
- Read-only anchor: `src/renderer/screens/main.tsx` (wiring lives with `state-routing`; if you need a tab added/removed/renamed, file a request there)
- Don't change: the `TabId` union without coordinating with `state-routing` — every tab imports `TabId` from `appStore.ts`

## How you work
- Each tab is a self-contained React 19 functional component with hooks; no class components, no `useEffect` for derived state (use Zustand selectors)
- Inputs flow in via `useAppStore()` selectors; outputs flow out via store actions
- Tailwind v4 utilities only — no inline `style` props except for dynamic SVG geometry that has no token
- Accessibility: every interactive element needs a label and a visible keyboard focus ring; modal actions need focus trapping
- See `docs/ui-ux-touchpoint-report-2026-06-18.md` for the active UI audit baseline; mirror its `Tabs` section shape when you extend an existing tab
- Reduced-motion: animations respect `useReducedMotion()` from `src/renderer/src/hooks/useReducedMotion.ts`

## Stop when
- `pnpm dev` (or `pnpm dev --watch`) renders the tab in Electron with zero console errors
- `pnpm vitest run src/renderer/src/tabs` is green (where tests exist)
- `pnpm typecheck` is clean; `pnpm lint` reports no new errors in `tabs/**`
- Any new interactive control has a visible focus state, a screen-reader label, and a reduced-motion fallback
- Per-tab evidence folder under `evidence/e2e-electron/<tab-slug>/` is updated (or a follow-up note is filed to `qa-e2e`)
