---
name: cannabis-chemistry-calculator
description: Multi-agent team for the Cannabis Chemistry Calculator Electron desktop app (decarboxylation, fat infusion, dose estimation). Seven specialised reins cover pure-TS chemistry math, the ten UI tabs, the design system, heavy non-tab feature widgets, Zustand state + startup routing, the Electron shell, and the Playwright-MCP-driven E2E validation workflow. The Wizard (recipe-style guided workflow — the new UI/UX that replaces the coverflow + open-form input grids) lives behind the `wizardEnabled` feature flag for staged rollout, with the carousel landing as the entry point.
displayName: Cannabis Chemistry Calculator Team
---

# Cannabis Chemistry Calculator — Project Harness

Multi-agent team for the Cannabis Chemistry Calculator Electron desktop app (Electron 39 + React 19 + TypeScript 5.9 + Vite 7 + Tailwind v4 + Zustand). Stack and architecture rationale in `DESIGN.md`; engineering audit baseline in `validation_report.md` and `docs/ui-ux-touchpoint-topology-2026-06-18.json`. The Wizard (recipe-style guided workflow shipped Weeks 1-7 of 2026-07) is the new UI/UX — the carousel landing stays, the wizard extends from it inline. Recipe + extraction + cooking timers run as one continuous flow. Behind the `wizardEnabled` feature flag for staged rollout. Documented in `docs/wizard-architecture-2026-07-26.md` (architecture) + `docs/wizard-build-handoff-2026-07-27.md` (build log + Week 8 plan + deferred follow-ups) + `wizard-uiux-preview.html` (UI/UX preview).

## Team roster

| Rein | Role |
|---|---|
| `chem-engine` | Pure-TypeScript chemistry calculation engine — decarb kinetics, fat infusion, dose estimation, units, Zod validation |
| `ui-tabs` | Ten calculator-screen tabs (Dashboard, Quick Batch, Decarb, Infusion, Dose, Methods, Advanced Tools, Knowledge, Journal, First Timer Guide) — plus the Wizard surface (`WizardScreen` + the equipment carousel + the recipe stepper + the Stage 1/2 execution shells). The Wizard is the new UI/UX; the open-form tabs are being migrated into recipe steps over the build cycles. |
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

## Wizard (recipe-style, behind `wizardEnabled` for staged rollout)

The Wizard is a recipe-style guided workflow that walks the user from raw cannabis material to a finished edible. The carousel landing is the END PRODUCT (Brownies / Gummies / Capsules / Tincture / Salve / Custom); picking one starts the inline wizard. The equipment carousel is the next step (Oven / Sous vide / Stove / Slow cooker / Toaster oven). Then the recipe opens with a read-only "you'll need" list (cannabis + fat + pantry + equipment) and runs through the steps inline. Extraction (decarb + infusion) and cooking (format-specific) each run with live timers.

The recipe IS the configuration — there are no separate "do you have X?" follow-up questions. The "you'll need" section is a read-only reference; the user reads it and either gathers what they need or picks a different recipe. Equipment picked from the carousel is the constraint that filters which method options appear in the recipe's step sequence.

- **Flag:** `wizardEnabled: boolean` in `appStore.ts`, default `false`. Flip in DevTools: `window.localStorage.setItem('ccc-wizard-enabled', 'true')` then reload. Staged rollout — the new UI/UX ships behind the flag while the existing tabs continue to work.
- **Architecture (read first before any wizard work):** `docs/wizard-architecture-2026-07-26.md` — 10 sections, signed off by the user. **Note:** §1 and §5.1 of the architecture doc describe the wizard as "replacing the coverflow" — the user clarified the carousel stays as the landing and the wizard extends from it. The doc reflects an early framing; the canonical product model is the v2.2 UI/UX preview at `wizard-uiux-preview.html`.
- **Build log (read first for state of play):** `docs/wizard-build-handoff-2026-07-27.md` — Weeks 1-7 complete (54 commits), Week 8 = real-user beta, 5 deferred follow-ups.
- **UI/UX preview:** `wizard-uiux-preview.html` (workspace parent) — 7 mockup screens + a product-flow diagram + a what-changed table.
- **Ownership split:** the wizard's `wizard` slice + `branchSequences` + `stage2Steps` + `recipes[]` slice + persist migrations live with `state-routing`. The Wizard's React components (`WizardScreen`, the equipment carousel, the recipe stepper, the Stage-2 shells, `StockRecipeCard`, `NameRecipeStep`, etc.) live with `ui-tabs`. Wizard-specific engine code (`branchSequences` step defs, `decbMethodCards`) lives with `ui-tabs` not `chem-engine` (it's UI-presentation-layer data, not pure math).
- **Coordination rule:** any change to a branch's `branchSequences.ts` step list requires a corresponding update to `validateWizardSelections` in `state-routing` (the Week 7 lesson: validators must read the canonical sequence table, not a free-text "non-Topical" rule).
- **Aesthetic:** glassmorphism dark is preserved — only the UX flow, presentation, and step sequencing change. Don't introduce new design tokens.
