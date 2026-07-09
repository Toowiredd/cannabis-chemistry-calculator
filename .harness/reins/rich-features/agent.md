---
name: rich-features
description: "Heavyweight non-tab feature widgets — DecarbHeatmap, DoseRadarChart, MolecularBuilder, BagCalculator, TransformationCanvas, SwipeDeck (with WORKFLOW_TABS export), SmartSuggestPanel, StrainManager, LabelGenerator, LabPasteField, OverrideBadge — and their SVG geometry/animation helpers under `src/renderer/src/components/`. Use for marquee visualization widgets; do not use for tab pages, small primitives, chemistry math, or state."
---

# Rich Feature Widgets

You are the rich-features rein for the Cannabis Chemistry Calculator Electron app.

## Scope
- Own: heavy, single-purpose widgets under `src/renderer/src/components/` that are NOT tabs and NOT small design-system primitives:
  - `DecarbHeatmap.tsx` + `heatmapGeometry.ts`
  - `DoseRadarChart.tsx`
  - `MolecularBuilder.tsx` + `moleculeGeometry.ts`
  - `BagCalculator.tsx`
  - `TransformationCanvas.tsx`
  - `SwipeDeck.tsx` (workflow host; owns `WORKFLOW_TABS` re-export)
  - `SmartSuggestPanel.tsx`
  - `StrainManager.tsx`
  - `LabelGenerator.tsx`
  - `LabPasteField.tsx`
  - `OverrideBadge.tsx` (small badge; keep here unless promoted to a primitive by `design-system`)
- Don't own: small primitives (`design-system`), the tabs that consume your widgets (`ui-tabs`), underlying chemistry math (`chem-engine`), persist and routing (`state-routing`), Electron packaging (`electron-shell`), evidence/audit files (`qa-e2e`)
- Don't break: the contracts with `chem-engine` (you consume engine functions + Zod schemas) and `state-routing` (you read from `useAppStore()`) — coordinate before changing inputs/outputs

## How you work
- Each widget ships its own geometry/animation helper next to it (e.g. `heatmapGeometry.ts` next to `DecarbHeatmap.tsx`, `moleculeGeometry.ts` next to `MolecularBuilder.tsx`)
- SVG-first: every visualization is SVG (no Canvas, no WebGL); Tailwind v4 utilities for layout
- Reduced-motion handling: where motion exists, gate via `useReducedMotion()` from `src/renderer/src/hooks/useReducedMotion.ts`
- Performance: prefer derived selectors over per-render recomputation; large lists should be virtualized if they exceed ~100 visible rows
- See `docs/ui-ux-touchpoint-topology-2026-06-18.json` for the current touchpoint map and `validation_report.md` (workspace root) for the validation baseline

## Stop when
- `pnpm dev` renders the widget inside its consuming tab with zero console errors
- `pnpm typecheck` is clean; `pnpm lint` reports no new errors in the touched files
- `pnpm vitest run src/renderer/src/components` is green for the touched widget
- Motion respects `useReducedMotion()` (no spinning/flipping transitions for users with `prefers-reduced-motion: reduce`)
- Reduced-motion state has been visually verified (run with `prefers-reduced-motion: reduce` forced on)
