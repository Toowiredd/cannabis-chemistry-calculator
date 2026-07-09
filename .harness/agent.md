---
name: cannabis-chemistry-calculator
description: Multi-agent team for the Cannabis Chemistry Calculator Electron desktop app (decarboxylation, fat infusion, dose estimation). Seven specialised reins cover pure-TS chemistry math, the eleven UI tabs, the design system, heavy non-tab feature widgets, Zustand state + startup routing, the Electron shell, and the Playwright-MCP-driven E2E validation workflow.
displayName: Cannabis Chemistry Calculator Team
---

# Cannabis Chemistry Calculator — Project Harness

Multi-agent team for the Cannabis Chemistry Calculator Electron desktop app (Electron 39 + React 19 + TypeScript 5.9 + Vite 7 + Tailwind v4 + Zustand). Stack and architecture rationale in `DESIGN.md`; engineering audit baseline in `validation_report.md` and `docs/ui-ux-touchpoint-topology-2026-06-18.json`.

## Team roster

| Rein | Role |
|---|---|
| `chem-engine` | Pure-TypeScript chemistry calculation engine — decarb kinetics, fat infusion, dose estimation, units, Zod validation |
| `ui-tabs` | Eleven calculator-screen tabs (Dashboard, Quick Batch, Decarb, Infusion, Dose, Methods, Advanced Tools, Knowledge, Journal, First Timer Guide) |
| `design-system` | Shared UI primitives and design tokens (shadcn-style primitives + GlassCard / InputRow / Toast / TooltipIcon / UnitToggle / TitleBar / TabActions + Tailwind v4 tokens) |
| `rich-features` | Heavyweight non-tab widgets — DecarbHeatmap, DoseRadarChart, MolecularBuilder, BagCalculator, TransformationCanvas, SwipeDeck, SmartSuggestPanel, StrainManager, LabelGenerator, LabPasteField, OverrideBadge |
| `state-routing` | Cross-tab application state, persist hydration, and first-launch routing — owns `appStore.ts`, `startupRouting.ts`, `StartupChooser`, `docs/startup-routing-master.md` |
| `electron-shell` | Electron main process, preload IPC bridge, packaging, release pipeline |
| `qa-e2e` | End-to-end validation, UI/UX audits, touchpoint evidence (Playwright MCP via CDP port 9222) |

## Project skills (none yet)

This harness reserves `.harness/skills/` for project-scoped skills. No project skills are defined yet — global skills (`~/.mavis/skills/`) and built-in skills (`~/.mavis/.builtin-skills/`) are still discoverable via `opencode.json` skill paths.

## Deliverable

A working, polished Electron desktop app for cannabis chemistry calculations. All eleven tabs render cleanly, console-clean on every interaction, every touchpoint covered by the QA-E2E audit matrix, packaged via `pnpm build`.

## Anti-fabrication contract (binding on all reins)

- No invented chemistry constants — every constant traceable to `research/academic-references.md` (or a citation added in the same change)
- No invented lures / strains / SKU codes in `strainLib.ts` — only real, named cannabis chemovars
- No fabricated UI touchpoints — the touchpoint list in `docs/ui-ux-touchpoint-topology-2026-06-18.json` is the contract
- No shipped regressions — Vitest in `chem-engine`, visual smoke in `qa-e2e`
- No edit to `TabId` union without coordinating `ui-tabs` ↔ `state-routing`
- No edit to preload IPC exports without coordinating `electron-shell` ↔ renderer's `global.d.ts` in the same change

## Workflow

1. `chem-engine` ships engine changes behind Vitest; `ui-tabs` / `rich-features` consume them via existing imports
2. `design-system` extends primitives → consuming reins migrate to new props in the same change that adopts them
3. `state-routing` coordinates `TabId`, persist migrations, and startup branching with `ui-tabs` and `qa-e2e`
4. `electron-shell` ships packaging/native changes only after `pnpm compile:app` and a packaged-binary smoke test pass
5. `qa-e2e` runs the per-tab matrix after any visible-area change and writes findings to `docs/e2e-electron-ux-audit-*.md` and workspace-root `validation_report.md`
