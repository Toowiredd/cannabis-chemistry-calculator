# Design Summary — Cannabis Chemistry Calculator

> **Accuracy note (added 2026-07-25):** A 4-reader + adversarial-pass arch-review (see `audit/40-ARCH-REVIEW-20260725.md`) found 4 self-contradictions in this doc (AN.1): the engine purity contract was overstated, the Zod-schema claim glossed over the two-file split, the engine-test count was out of date by ~7x, and the "deterministic" framing hid the doneness-heatmap renormalize caveat. Most of the substantive issues are FIXED inline (search for `2026-07-25` in this file). When the code and this doc disagree, **the code is the source of truth** — but if you find a new contradiction, file it as a P1 doc-drift finding, not a code-change request.

This document covers the architecture choices, modeling rationale, and design decisions made during the development of the Cannabis Chemistry Calculator.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Layered Design](#layered-design)
3. [Electron Shell Design](#electron-shell-design)
4. [Chemistry Model Rationale](#chemistry-model-rationale)
5. [Engine Citations & Audit](#engine-citations--audit)
6. [Preset Design Rationale](#preset-design-rationale)
7. [State Management](#state-management)
8. [Validation Strategy](#validation-strategy)
9. [UI/UX Decisions](#uiux-decisions)
10. [Testing Strategy](#testing-strategy)
11. [Packaging & Distribution](#packaging--distribution)

---

## Architecture Overview

The application follows a **layered architecture** with a hard boundary between the calculation engine and the UI. This gives us:

- **Testability** — Engine functions can be validated in isolation with 100% deterministic behavior.
- **Portability** — The engine is pure TypeScript and could be reused in a web app, CLI, or mobile wrapper without modification.
- **Maintainability** — UI changes cannot accidentally alter calculation results.

The codebase is organized into four primary layers:

1. **Presentation Layer** (React 19 + Tailwind CSS v4)
2. **State Layer** (Zustand with persist middleware)
3. **Engine Layer** (Pure TypeScript, no React/DOM/Electron imports — see line 56 for the precise purity contract)
4. **Preset Data Layer** (Typed const arrays)

---

## Layered Design

### Engine Layer (src/renderer/src/engine/)

The engine is the heart of the application. All functions are deterministic, pure, and side-effect-free — no network calls, no DOM access, no randomness.

| Module | Purpose |
|--------|---------|
| `decarb.ts` | Theoretical max THC, decarb-adjusted ranges |
| `infusion.ts` | Infused THC total, concentration, simplified estimates |
| `dosing.ts` | Per-serving dose, classification scale |
| `units.ts` | All unit conversions (g/oz, C/F, mL/tsp/tbsp/cup) |
| `validation.ts` | Zod schemas + warning generators |
| `models.ts` | TypeScript interfaces + preset data constants |
| `errors.ts` | Domain ValidationError class |

**Invariant:** The engine imports nothing from React, Electron, or any UI library. The reverse dependency is fine: UI imports engine. Engine functions may still throw (e.g. `volumeToMl` throws on an unknown unit; `calculateTheoreticalMax` throws on negative grams) — this is defensive, not a UI coupling. The "no UI dependencies" claim is about MODULE IMPORTS, not about runtime behavior.

#### Public Wizard API

The 4 id-based lookups in `wizardPresets.ts` form the public engine API for the First-Timer Guide wizard and are a stable contract: `getWizardRecipe`, `getDecarbMethodCard`, `getFatCard`, `suggestionsForRecipe`. Do not change their signatures without bumping the engine version noted here.

### State Layer (src/renderer/src/stores/appStore.ts)

A single Zustand store with `persist` middleware holds all mutable application state. This simplifies cross-tab data flows because every tab reads from and writes to the same object.

**Key state slices:**

- `activeTab` — Current tab ID
- `units` — Global unit preferences (persisted across restarts)
- `decarb` — Decarb tab inputs, preset ID, override values
- `infusion` — Infusion tab inputs, fat ID, custom efficiency
- `dose` — Dose tab inputs
- `lastDecarbExpected`, `lastInfusedThc` — Cached upstream results for carry-forward

**Why Zustand?** Zustand was chosen over Redux or Context for:

- Minimal boilerplate (no actions/reducers)
- Native TypeScript support
- Small bundle size (~1 KB)
- Built-in persist middleware for local storage
- Good selector performance out of the box

### Presentation Layer (src/renderer/src/tabs/)

Each tab is a self-contained React component that:

1. Reads current state from Zustand
2. Validates user input via Zod schemas
3. Calls engine functions on valid input
4. Renders results in glassmorphism cards

**Tab composition pattern:**

- Input panel (glass card)
- Result panel (glass card)
- Quality badges (small glass pills)
- Unit toggles (segmented control)
- Action bar (Export, Copy, Reset, Save/Load)
- Disclaimer footer

---

## Electron Shell Design

### Frameless Window

The main window is `frameless: true` with `titleBarStyle: 'hidden'`. A custom `TitleBar` React component replaces the native chrome, providing:

- App branding (left)
- Minimize / Maximize / Close buttons (right)
- Native drag region for moving the window

Frameless windows are common in Electron apps because they let the UI extend to the window edge without a visual break.

### Preload Security

The preload script exposes a minimal API surface via `contextBridge`:

```typescript
window.App = {
  window: { minimize, maximize, close },
  exportReport,
  copyToClipboard,
  savePreset,
  loadPresetDialog,
  platform,
}
```

**Rationale:** Exposing only the required IPC methods minimizes the attack surface. No Node API is exposed to the renderer.

### IPC Handlers (main process)

- `export-report` — Opens a native save dialog, writes both `.txt` and `.json` reports
- `copy-to-clipboard` — Writes text to the system clipboard
- `save-preset` — Saves state JSON to `%APPDATA%/presets/` with hash-based deduplication
- `load-preset-dialog` — Opens a native open dialog filtered to `.json`

---

## Chemistry Model Rationale

### Theoretical Maximum THC

**Formula:** `grams * ((THCA% / 100) * 0.877 + (THC% / 100)) * 1000`

**The 0.877 factor** is the molecular weight ratio:

- THCA (tetrahydrocannabinolic acid) molecular weight: ~358.47 g/mol
- THC (delta-9-tetrahydrocannabinol) molecular weight: ~314.45 g/mol
- Ratio: 314.45 / 358.47 ≈ 0.877

During decarboxylation, THCA loses a carboxyl group (COOH, MW ≈ 44.01) and becomes THC. Because the resulting molecule is lighter, the maximum THC yield from a given amount of THCA is ~87.7% of the THCA mass, not 100%.

**Why include existing THC?** Some cannabis material already contains decarboxylated THC (e.g., aged or heat-exposed flower). This THC contributes directly to total potency without the 0.877 penalty, so it is added linearly.

### Decarb Efficiency

Real-world decarboxylation never achieves 100% conversion. Efficiency depends on:

- **Temperature** — Higher temps accelerate decarb but increase CBN degradation
- **Time** — Longer generally improves conversion up to a ceiling
- **Oxygen exposure** — Oxygen accelerates THC oxidation to CBN
- **Moisture** — Water bath / sous vide methods suppress oxidation

The engine supports **range-based efficiency** (low / expected / high) to acknowledge real-world variability.

### Fat Infusion Chemistry

THC is lipophilic (fat-soluble) but not perfectly extracted. Efficiency depends on:

- **Fat type** — MCT > Ghee > Coconut Oil (based on medium-chain triglyceride content)
- **Temperature** — Warm fat (~60–80°C) improves transfer without degrading THC
- **Time** — Longer contact improves yield but with diminishing returns
- **Surface area** — Finely ground material increases contact area

The simplified multiplier (`grams * THCA% * multiplier`) is a back-of-the-envelope shortcut that bakes decarb efficiency + extraction efficiency into a single number per fat.

### Dose Classification

The classification scale is designed around **commonly cited clinical ranges**:

- **Sub-microdose (< 2.5 mg)** — Sub-perceptual, potential anti-inflammatory
- **Microdose (2.5–5 mg)** — Mild relief, functional
- **Low (5–10 mg)** — Noticeable effect, still functional for most users
- **Moderate (10–25 mg)** — Standard recreational dose
- **Strong (25–50 mg)** — Intense, possible impairment
- **Very strong (50–100 mg)** — High-tolerance user territory
- **Extreme (100+ mg)** — Medical / concentrate user territory

Boundaries use **inclusive floor, exclusive ceiling** to avoid double-labeling at exact boundary values.

---

## Preset Design Rationale

### Decarboxylation Methods (6 presets)

| Method | Design Intent |
|--------|---------------|
| **Sous Vide — Dry** | Best balance of potency and terpene retention. Vacuum-sealed dry flower in water bath.
|
| **Sous Vide — Combined** | Lower temp for longer time — prioritizes terpene preservation over maximum conversion. |
| **Sous Vide — Fast** | Higher temp, shorter time — for impatient users. |
| **Sous Vide — Low Temp** | Absolute minimum viable temp for terpene preservation. Lowest efficiency but highest terpenes. |
| **Oven — Sealed Container** | Most accessible home method. Sealed jar limits oxygen but higher temp than sous vide. |
| **Oven — Open Air** | Fastest method but highest CBN risk and lowest terpenes. Included for completeness — not recommended. |

**Why 73°C floor?** Below 73°C, decarboxylation is impractically slow (days). The 73°C × 8–12 hour window of SV Low Temp is the minimum viable for a "terpene-first" decarb.

**Why 116°C ceiling?** Above 116°C, THC degrades to CBN faster than THCA converts to THC, creating a net loss. Open-air oven methods at 116°C already represent a compromise.

### Carrier Fats (4 presets)

| Fat | Rationale |
|-----|-----------|
| **Ghee** | Traditional choice. Clarified butter has a high smoke point (~252°C) and good cannabinoid solubility. The 0.85 extraction efficiency is a conservative estimate based on peer-reviewed extraction studies. |
| **Coconut Oil** | Popular alternative with high saturated fat content. Solid at room temperature, making it easy to portion. |
| **MCT Oil** | Fractionated coconut oil with highest extraction efficiency (0.92). Liquid at room temp, neutral flavor, easiest to measure. |
| **Custom** | Allows users to enter any efficiency value. Simplified multiplier is disabled because there is no known multiplier for arbitrary fats. |

---

## State Management

### Why a Single Store?

All six tabs share the same Zustand store. This enables:

- **Cross-tab carry-forward** — Decarb expected result automatically feeds Infusion tab
- **Global unit preferences** — Changing C/F on one tab changes it everywhere
- **Persistent state across restarts** — Persist middleware saves to localStorage

### Why Not Context?

React Context would require a Provider at the app root and would trigger re-renders of all consumers on any state change. Zustand selectors allow fine-grained subscriptions, reducing unnecessary renders.

### Persist Strategy

Ten slices are persisted across restarts under the localStorage key
`ccc-app-state` (renamed from the misleading `cannabis-chem-units` in
the 2026-07-25 Cluster C refactor — F2.1 — the old name implied only
the `units` slice was persisted, but the partialize has long carried
9 other slices too). The persisted slices are:

- `decarb` (Decarb tab inputs, preset ID, override values)
- `infusion` (Infusion tab inputs, fat ID, custom efficiency)
- `dose` (Dose tab inputs, format ID)
- `advancedTools` (Advanced Tools sub-tab state)
- `startupRouting` (last-successful-path routing heuristic counters
  and the last-successful intent/tab pair — used by the startup
  chooser heuristic in `utils/startupRouting.ts`)
- `units` (global unit preferences: temperature, weight, volume, bag)
- `theme` (`dark` | `light`)
- `label` (batch label inputs: product name, ingredients, storage, etc.)
- `inventory` (Dashboard inventory items + low-stock threshold)
- `firstRunDismissed` (bootstrap gate flag for the first-run wizard)
- `wizard` (the multi-select kit configurator: `dismissed` boolean +
  `selections` object — `active` and `stepIndex` are runtime-only and
  reset to defaults on every reload by the custom `merge` function
  in `appStore.ts`)

Journal entries are NOT persisted by the Zustand store — they live
on disk via the Electron `window.App.saveJournalEntry` IPC bridge
and are loaded on demand by the Journal tab's mount effect. AVB
inventory items have a `kind` field that is backfilled to `'flower'`
on legacy v2 envelopes (the v2→v3 migration).

Tab input values for the OTHER tabs (Decarb, Infusion, Dose) ARE
persisted, but the user can always hit a "Reset" button to clear
them — so the "users may not want their last calculation to reappear"
caveat is honored via the explicit Reset, not via "don't persist".
Presets provide an additional, opt-in persistence layer when a user
wants to save a specific recipe for later.

---

## Validation Strategy

### Zod Schema Approach

There are **two** Zod-schema files in the engine, used at different layers:

- `engine/validation.ts` — engine-boundary validators. Used by the engine's own test suite and by the engine's defensive throws (negative inputs, division-by-zero). Returns `ValidationResult<T>` wrappers for engine callers.
- `engine/schemas.ts` — form-boundary schemas. Built for `@hookform/resolvers` + `react-hook-form`; takes raw `<input>` strings and transforms/refines them to typed values. The current UI tabs do NOT consume these directly yet (the F3.18 follow-up), so the UI's validation is currently the hand-rolled `loadFromPreset` guard in `appStore.ts:920-1083`.

The "two Zod files" split is intentional but the actual consumer count is low — `validation.ts` has 1 consumer (the engine test suite), `schemas.ts` has 0 (the form-library integration is deferred). The `loadFromPreset` hand-rolled guard is the de facto runtime validator today.

- **Hard errors** — Block calculation and display inline messages (negative values, >100% THCA, zero volume, etc.)
- **Warnings** — Display advisory messages but allow calculation (high total cannabinoid >40%, low fat volume)

**Why Zod?** Zod provides:

- Type-safe schema definitions
- Clear error messages out of the box
- Composable refinements (e.g., `thcaPct + thcPct <= 100`)
- Small bundle size

### Debounced Recalculation

Input changes trigger recalculation after 300 ms of inactivity. This prevents:

- CPU thrashing during rapid typing
- Flickering intermediate results
- Excessive re-renders

The debounce is implemented with `useEffect` + `setTimeout`/`clearTimeout` in each tab component.

---

## UI/UX Decisions

### Glassmorphism Design Language

The visual identity is built on **glassmorphism**:

- `backdrop-blur-xl` — Heavy blur for depth
- `bg-white/10` — Translucent white background
- `border-white/20` — Subtle borders for definition
- `shadow-2xl shadow-black/20` — Deep shadows for lift

I went with glassmorphism because it looks clean and technical without feeling like a spreadsheet. The dark mode default cuts down on eye strain during long sessions.

### Text-Only Labels

All labels, badges, and tooltips use text only — no emoji, no decorative Unicode symbols. The `lucide-react` icon library provides semantic icons (Info, RotateCcw, ChevronDown, etc.) where needed.

**Rationale:** Emoji can render inconsistently across Windows versions and screen readers. Text labels are universally accessible.

### Override Highlighting

When a user edits a preset value, the input gets:

- Amber border (`border-amber-400`)
- "Override" badge

The amber border + badge is a clear signal: "you're not on the preset anymore."

### Responsive Constraints

- **Minimum:** 1024×640 — Ensures all inputs fit without scrolling
- **Maximum:** 1400 px content width — Prevents text from stretching unreadably on ultrawide monitors
- **Window resizing** — Flexbox + `max-w-[1400px]` ensures layout integrity

---

## Testing Strategy

### Engine Unit Tests (vitest)

1,148 tests across 60 test files (as of 2026-07-25) are deterministic and the full suite runs in <30s. The "deterministic" claim is precise: every test produces the same output for the same input, no RNG, no clock, no network. The "ground truth" framing is **relative, not absolute** — see the `doneness-simulation.ts` renormalize caveat in the heatmap (F2.10, AN.4 in the 2026-07-25 arch-review): the doneness chart renormalizes mass to 1.0 per step and caps CBN at 10% for readability. Both are deliberate visualization choices, not physics. Test categories:

- **Happy path** — Valid inputs produce expected outputs
- **Boundary values** — Zero, max, exact classification thresholds
- **Error cases** — Negative inputs, >100%, division by zero
- **Reversibility** — Unit conversions (g→oz→g, C→F→C)
- **Data integrity** — Preset values within bounds, no duplicates
- **Migration guards** — Persist v1→v7 chained upgrade (JournalEntry.source, InventoryItem.kind, JournalEntry.materialWeightUnit, firstTimerOpen collapse, dismiss merge, per-tab unit-field normalization) — these tests pin the v4→v7 contract so a future refactor of the migration block can't silently regress the returning-user path

### GUI Verification (agent-browser)

The Electron app exposes Chrome DevTools Protocol. The `agent-browser` skill automates:

- Tab navigation and input entry
- Result text verification against expected engine output
- Screenshot capture for visual regression
- Console error auditing

### Manual Verification

Final visual polish (typography, contrast, resize behavior, animation smoothness) is verified by launching the packaged `.exe`.

---

## Packaging & Distribution

### electron-builder Configuration

The packaging setup is designed for **Windows-first** distribution with cross-platform capability:

- **NSIS** — Full Windows installer with shortcuts and uninstaller
- **portable** — Single-file .exe for USB distribution
- **zip** — Portable archive for advanced users

### Build Pipeline

```
package.json scripts
  prebuild → clean:dev + compile:app + compile:packageJSON
  build    → electron-builder (uses dist package.json)
```

The `prebuild` step:

1. Removes stale `.dev/` artifacts
2. Vite builds main (ESM), preload, and renderer bundles
3. Generates a clean `package.json` for the dist folder

### Versioning

- Source `package.json` version is the **source of truth**
- `electron-builder.ts` reads version dynamically
- Export reports read version from `package.json`

### Artifacts

After `pnpm package`, the `dist/v{version}/` folder contains:

```
dist/v1.0.0/
|-- cannabis-chemistry-calculator-v1.0.0-win.exe          # NSIS installer
|-- cannabis-chemistry-calculator-v1.0.0-win.zip            # Portable zip
|-- cannabis-chemistry-calculator-v1.0.0-win-portable.exe  # Single-file portable
|-- win-unpacked/                                          # Unpacked files (for debugging)
```

---

## Design Trade-offs

| Decision | Alternative | Rationale |
|----------|-------------|-----------|
| No charting library | Recharts, Chart.js | SVG inline paths are lighter (~1 KB vs 50+ KB), fully themed, zero external dependency |
| No CSS-in-JS | Styled-components, Emotion | Tailwind v4 is faster at build time and easier to maintain in a team |
| No database | SQLite, localStorage | JSON files in `%APPDATA%` are sufficient for preset persistence; no schema migration needed |
| Single store | Multiple stores | Cross-tab data flow is simpler with one store; Zustand selectors prevent performance issues |
| Frameless window | Native frame | Glassmorphism needs edge-to-edge rendering; custom title bar is normal for Electron apps |
| Text-only labels | Emoji | Accessibility, consistency across OS versions, professional tone |

---

## Wizard (the UI/UX)

The Wizard IS the UI/UX. It is not an overlay on top of the open-form tabs — it is the primary surface, with the open-form tabs (Decarb / Infusion / Dose / Quick Batch) being migrated into recipe steps over the build cycles. The carousel landing is the entry point: Brownies / Gummies / Capsules / Tincture / Salve / Custom as the end products. Picking one starts the inline wizard — an equipment carousel for the heat source (Oven / Sous vide / Stove / Slow cooker / Toaster oven), then the recipe opens with a read-only "you'll need" list (cannabis + fat + pantry + equipment), then the recipe runs through the steps inline — extraction (decarb + infusion) and cooking (format-specific: oven bake, set in fridge, salve pour, tincture macerate) each with live timers, heatmaps, and "stir now" prompts.

The recipe IS the configuration — no separate "do you have X?" follow-up questions. The "you'll need" section is a read-only reference; the user reads it and either gathers what they need or picks a different recipe. Equipment picked from the carousel is the constraint that filters which method options appear in the recipe's step sequence (e.g., an oven-only user doesn't see sous vide methods).

The engine math is shared with the open-form tabs (no duplicated chemistry); the wizard walks the user through the same engine calls one step at a time. Glassmorphism dark aesthetic is preserved across the wizard surface — only the UX flow, presentation, and step sequencing change.

Full architecture rationale (state machine, branch taxonomy, Stage 2 stepper contract, re-edit recalculating UX, plain-language product-type labels) lives in `docs/wizard-architecture-2026-07-26.md` (10 sections, signed off by the user; note that §1 and §5.1 reflect an early framing where the wizard was described as "replacing the coverflow" — the actual product model is the wizard IS the UI/UX, the carousel stays as the landing, and the open-form tabs are being migrated). Build log (54 commits across Weeks 1-7, Week 8 plan, 5 deferred follow-ups) lives in `docs/wizard-build-handoff-2026-07-27.md`. UI/UX preview at `wizard-uiux-preview.html` (workspace parent).

**Why a separate doc, not a section here:** DESIGN.md is the engine + architecture rationale for the underlying engine + state management; the Wizard has its own state machine (`wizard` slice), branch taxonomy, and execution runtime (`execution` slice). Inlining the full design here would duplicate the wizard doc and risk drift. A pointer keeps both documents in sync by reference.

## Engine Citations & Audit

Every numeric / qualitative constant in `src/renderer/src/engine/*.ts` is traceable to either:

1. A peer-reviewed source listed in `research/academic-references.md` (with a stable DOI / URL)
2. An explicit `// TODO(citation): <reason>` comment in source + a row in the audit table
3. An exact NIST / SI conversion factor (NIST CODATA universal gas constant, SI avoirdupois ounce, etc.)

The audit table at the bottom of `research/academic-references.md` lists each constant, its current citation status, the action taken (kept / added / flagged TODO), and the verifier note. The audit was originally produced by `chem-engine` rein via `mavis team plan` and is updated as drift flags are resolved.

### Arrhenius kinetics — Jaidee 2022 recompute (2026-07-09)

The THC→CBN step in `doneness-simulation.ts` previously used `Ea₂ = 110 kJ/mol` (engineering default) and `A₂ = 2.0×10¹² s⁻¹` (no source match). These produced a THC halflife at room temperature of < 1 hour — unphysical for storage modeling.

Recomputed from **Jaidee 2022** Table 3 (DOI 10.1089/can.2021.0004, pH-2 solution pseudo-first-order Δ9-THC degradation):

- `Ea₂ = 51.70 kJ/mol`
- `A₂ = 6.40×10⁶ day⁻¹` (paper convention; engine divides by 1440 for per-minute)
- Sanity: `k₂(25 °C) ≈ 3.94×10⁻⁶ /min → halflife ≈ 122 days`, matching Jaidee's published `k@25 °C = 0.0056 day⁻¹` within 0.01% relative

**Math-form note.** Jaidee's *dried-resin* Δ9-THC measurement is pseudo-zero-order (rate ∝ constant, not concentration) — a different mathematical form than the engine's first-order ODE. Switching to dried-resin pseudo-zero-order would require changing the simulation ODE itself, which is out of scope. The pH-2 solution pseudo-first-order value above is the matching Jaidee source for the current ODE form.

The `Ea₁/A₁` pair (THCA→THC) still uses the engineering overestimate on top of Wang 2016 (`#2`); a separate cleanup pass is planned.

### Arrhenius kinetics — Wang 2016 recompute (2026-07-25)

The THCA→THC step in `doneness-simulation.ts` previously used `Ea₁ = 92 kJ/mol` (upper end of Wang 2016's reported range, engineering choice) and `A₁ = 1.5×10¹² s⁻¹` — a 10⁴× overestimate of Wang 2016's published k₀, chosen to favor visible activity in the simulated UI at the 30-min/120 °C decarb window. Audit table rows 13 & 15 in `research/academic-references.md` flagged this for years.

Recomputed from **Wang 2016** Table 2 (DOI 10.1089/can.2016.0020, p. 270, 1(1):262–271), 3 first-order rate constants for THCA-A in cannabis extracts at 80 °C, 95 °C, 110 °C (k = 0.18, 0.66, 1.83 × 10⁻³ s⁻¹):

- `Ea₁ = 87.06 kJ/mol`
- `A₁ = 1.40 × 10⁹ s⁻¹` (stored as 8.4 × 10¹⁰ min⁻¹ to match the engine's minute-scale time axis)
- Fit quality: R² = 0.998 over the 3 measured points
- Wang 2016's own rounded summary in Table 2 reads `Ea = 88 kJ/mol, k₀ = 8.7 × 10⁸ s⁻¹` — internally inconsistent with their own data (gives ~55 % underestimate at all 3 measured points, because k₀ was computed from the rounded EA). The regression is the more honest fit.

The 2026-07-25 cleanup pass replaced the engineering estimate with a Wang 2016 Arrhenius fit. The decarb window is now physically grounded rather than fitted. Test coverage in `doneness-simulation.test.ts` pins the new constants to the cited measurements (3 measured-point tests at 80/95/110 °C, 3 regression-consistency tests at 100/120/140 °C, Q10 test, 25 °C extrapolation band, and an integration test for the 30-min/120 °C window).

**Extrapolation caveat.** The Arrhenius fit is from 80–110 °C only. At 25 °C it predicts k ≈ 7.8 × 10⁻⁷ s⁻¹ → halflife ≈ 10 days. The 1–100 year room-temperature stability of THCA in plant material is an empirical observation that is NOT supported by Wang 2016 alone — it would require a different Ea at low T (curved Arrhenius plot, distinct mechanism, or a low-T-specific citation such as Trofin 2012 / Lindholst 2010, both currently flagged ⚠ unverified). See `doneness-simulation.ts` header and the 25 °C halflife test in `doneness-simulation.test.ts` for the full caveat.

---

## Future Considerations

- **macOS packaging** — .dmg target already configured; testing needed on Apple Silicon
- **Linux packaging** — AppImage, .deb, .rpm targets configured; testing needed on Ubuntu/Fedora
- **Auto-updater** — electron-updater could be wired to `release` script with GitHub releases
- **Additional fats** — Olive oil, butter, avocado oil could be added with peer-reviewed efficiency data
- **Terpene profiles** — Per-method terpene retention could be quantified (mg/g) with lab data
- **Batch calculations** — CSV import for multi-batch planning
