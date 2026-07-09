# Design Summary — Cannabis Chemistry Calculator

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
3. **Engine Layer** (Pure TypeScript, zero UI dependencies)
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

**Invariant:** The engine imports nothing from React, Electron, or any UI library. The reverse dependency is fine: UI imports engine.

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

Only `units` is persisted across restarts. Tab input values are intentionally **not persisted** — users may not want their last calculation to reappear on the next launch. Presets provide explicit persistence when desired.

---

## Validation Strategy

### Zod Schema Approach

All inputs are validated through Zod schemas defined in `engine/validation.ts`:

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

All 166 engine tests are deterministic and run in <500 ms. Test categories:

- **Happy path** — Valid inputs produce expected outputs
- **Boundary values** — Zero, max, exact classification thresholds
- **Error cases** — Negative inputs, >100%, division by zero
- **Reversibility** — Unit conversions (g→oz→g, C→F→C)
- **Data integrity** — Preset values within bounds, no duplicates

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

---

## Future Considerations

- **macOS packaging** — .dmg target already configured; testing needed on Apple Silicon
- **Linux packaging** — AppImage, .deb, .rpm targets configured; testing needed on Ubuntu/Fedora
- **Auto-updater** — electron-updater could be wired to `release` script with GitHub releases
- **Additional fats** — Olive oil, butter, avocado oil could be added with peer-reviewed efficiency data
- **Terpene profiles** — Per-method terpene retention could be quantified (mg/g) with lab data
- **Batch calculations** — CSV import for multi-batch planning
