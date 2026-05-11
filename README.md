# Cannabis Chemistry Calculator

A local-first Electron desktop app for cannabis decarboxylation, fat infusion, and dose estimation calculations. Built with React 19, TypeScript 5, and Tailwind CSS v4.

## Overview

Cannabis Chemistry Calculator provides accurate, real-time heuristic estimates for:

- **Decarboxylation** — Calculate theoretical maximum THC and decarb-adjusted yields across six proven methods.
- **Fat Infusion** — Estimate total infused THC and concentration per unit (mL, tsp, tbsp, cup) for four carrier fats.
- **Dose Estimation** — Determine milligrams per serving and dose classification (microdose through extreme).
- **Method Comparison** — Compare all six decarboxylation methods side-by-side with shared inputs.
- **Fat Comparison** — Compare all four carrier fats side-by-side with shared inputs.
- **Knowledge Base** — Educational content covering the chemistry of decarboxylation, the 0.877 molecular weight factor, sous vide constraints, terpene retention trade-offs, and more.

All calculations are heuristic estimates, not laboratory results. The math is rooted in real chemistry — the 0.877 molecular weight ratio, extraction efficiency data from peer-reviewed studies — but your actual yield will vary with material quality, technique, and measurement accuracy. This tool is written for home cooks and small-batch makers, not commercial labs.

## Features

- Real-time recalculation with 300 ms debounce
- Six decarboxylation method presets (Sous Vide dry, combined, fast, low temp; Oven sealed, open air)
- Four fat infusion presets (Ghee, Coconut Oil, MCT Oil, Custom)
- Expert mode with editable temperature, time, and efficiency overrides
- Visual override highlighting (amber border + badge)
- Unit toggles: Celsius / Fahrenheit, grams / ounces, mL / tsp / tbsp / cups
- Inline Zod input validation with clear error messages
- Glassmorphism dark-mode UI with translucent panels
- Cross-tab data flow — upstream results carry forward to downstream tabs
- Export reports (human-readable .txt + structured .json)
- Copy summary to clipboard with toast confirmation
- Save and load custom presets (persistent JSON files)
- Responsive design from 1024x640 up to 4K
- Keyboard navigation (Tab order, Enter to trigger, Escape is benign)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop shell | Electron 39 + Electron Vite |
| UI framework | React 19 + TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (source-copied, not npm-dep) |
| Icons | lucide-react |
| State | Zustand + persist middleware |
| Forms | React Hook Form + Zod |
| Testing | vitest (engine unit tests) |
| Build | Vite + electron-builder |
| Verification | agent-browser (Electron CDP automation) |

## Prerequisites

- **Node.js** 20+ (verified with 22.x)
- **pnpm** 10+ (this project uses `pnpm@10.0.0`)

If you don't have pnpm installed:

```bash
npm install -g pnpm
```

## Install

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-org/cannabis-chemistry-calculator.git
cd cannabis-chemistry-calculator
pnpm install
```

The `postinstall` script automatically builds the development distribution and installs Electron app dependencies.

## Run

Start the development server with hot module replacement:

```bash
pnpm dev
```

The Electron window will open automatically. The renderer development server runs on `http://localhost:5173` (Electron Vite default). In dev mode, React DevTools are auto-loaded and the DevTools panel opens on startup.

## Test

Run the full engine unit test suite:

```bash
pnpm test
```

Expect **166 tests** across six test files:

- `decarb.test.ts` — Theoretical max, decarb-adjusted ranges, error handling
- `infusion.test.ts` — Infused THC, mg/mL concentration, simplified estimates
- `dosing.test.ts` — Per-serving dose, classification boundaries
- `units.test.ts` — g/oz, C/F, mL/tsp/tbsp/cup conversions
- `validation.test.ts` — Zod schema validation, warnings
- `models.test.ts` — Preset data integrity (6 methods, 4 fats, bounds)

## Build

Compile the application for distribution packaging:

```bash
pnpm build
```

This runs `compile:app` (Vite build for main, preload, renderer) and `compile:packageJSON` (generate dist package.json), then triggers `electron-builder`.

## Package

Create the Windows installer and portable executable:

```bash
pnpm package
```

Outputs are written to `dist/v{version}/`:

- `cannabis-chemistry-calculator-v{version}-win.exe` — NSIS installer
- `cannabis-chemistry-calculator-v{version}-win.zip` — Portable zip
- `cannabis-chemistry-calculator-v{version}-win-portable.exe` — Single-file portable

The NSIS installer supports per-user and system-wide installation, allows changing the install directory, and creates Start Menu and Desktop shortcuts.

### Verify the packaged app launches

After packaging, run:

```powershell
# Installer
.\dist\v1.0.0\cannabis-chemistry-calculator-v1.0.0-win.exe

# Or portable
.\dist\v1.0.0\cannabis-chemistry-calculator-v1.0.0-win-portable.exe
```

## Project Structure

```
cannabis-chemistry-calculator/
|-- src/
|   |-- main/
|   |   |-- index.ts              # Electron main process entry
|   |   |-- windows/
|   |       |-- main.ts           # MainWindow factory (frameless, IPC, dialogs)
|   |
|   |-- preload/
|   |   |-- index.ts              # contextBridge API (window controls, export, clipboard, presets)
|   |
|   |-- renderer/
|   |   |-- index.tsx             # React root renderer
|   |   |-- screens/
|   |   |   |-- main.tsx          # App shell (tabs, title bar, disclaimer)
|   |   |-- routes.tsx            # React Router routes (stub)
|   |   |-- src/
|   |       |-- tabs/
|   |       |   |-- DecarbTab.tsx     # Tab 1: Decarboxylation calculator
|   |       |   |-- InfusionTab.tsx   # Tab 2: Fat infusion calculator
|   |       |   |-- DoseTab.tsx       # Tab 3: Dose estimation calculator
|   |       |   |-- MethodsTab.tsx    # Tab 4: Method comparison
|   |       |   |-- FatsTab.tsx       # Tab 5: Fat comparison
|   |       |   |-- KnowledgeTab.tsx  # Tab 6: Educational content
|   |       |-- components/
|   |       |   |-- TitleBar.tsx      # Custom frameless title bar
|   |       |   |-- GlassCard.tsx     # Glassmorphism card container
|   |       |   |-- TabActions.tsx    # Export / Copy / Reset buttons
|   |       |   |-- PresetActions.tsx # Save / Load preset buttons
|   |       |   |-- Toast.tsx         # Toast notification system
|   |       |-- engine/
|   |       |   |-- decarb.ts        # Decarboxylation math
|   |       |   |-- infusion.ts      # Fat infusion math
|   |       |       |-- dosing.ts       # Dose estimation math
|   |       |   |-- units.ts         # Unit conversions
|   |       |   |-- validation.ts    # Zod validation schemas
|   |       |   |-- models.ts        # Domain types + preset data
|   |       |   |-- errors.ts        # ValidationError class
|   |       |   |-- __tests__/       # 166 vitest tests
|   |       |-- stores/
|   |       |   |-- appStore.ts      # Zustand store (tab state, units, persist)
|   |       |-- utils/
|   |       |   |-- exportReport.ts  # Text + JSON report generation
|   |
|   |-- lib/
|   |   |-- electron-app/            # Electron Vite boilerplate helpers
|   |
|   |-- shared/
|   |   |-- constants.ts             # Environment flags
|   |   |-- types.ts                 # Shared types
|   |   |-- utils.ts                 # Shared utilities
|   |
|   |-- resources/
|       |-- build/
|       |   |-- icons/               # .ico (Windows) and .icns (macOS)
|       |-- public/                  # Static assets
|
|-- package.json                 # Project metadata + scripts
|-- electron-builder.ts          # electron-builder configuration
|-- electron.vite.config.ts      # Vite build config for Electron
|-- tsconfig.json                # TypeScript configuration
|-- biome.json                   # Biome lint / format rules
|-- components.json              # shadcn/ui project config
|-- README.md                    # This file
|-- DESIGN.md                    # Architecture + chemistry model rationale
```

## Chemistry Model Summary

### Decarboxylation

**Theoretical maximum THC (mg)**

```
grams * ((THCA% / 100) * 0.877 + (THC% / 100)) * 1000
```

Where **0.877** is the molecular weight ratio of THC (314.45 g/mol) to THCA (358.47 g/mol). During decarboxylation, THCA loses its carboxyl group (COOH), reducing molecular weight.

**Decarb-adjusted THC (mg)**

```
theoretical_max * efficiency
```

Efficiency ranges per method: 0.60–0.98 depending on temperature, time, and oxygen exposure.

### Fat Infusion

**Total infused THC (mg)**

```
decarbed_THC * extraction_efficiency
```

**Concentration (mg per unit)**

```
total_infused / volume_in_mL
```

Per-unit labels adapt to the active volume unit (mL, tsp, tbsp, cup).

### Dose Estimation

**Per serving**

```
total_infused_THC / servings
```

**Classification scale** (inclusive floor, exclusive ceiling):

| Range (mg/serving) | Label |
|--------------------|-------|
| < 2.5 | sub-microdose |
| 2.5 – 5 | microdose |
| 5 – 10 | low |
| 10 – 25 | moderate |
| 25 – 50 | strong |
| 50 – 100 | very strong |
| >= 100 | extreme |

### Presets

**Decarboxylation methods**

| Method | Temp (C) | Time (min) | Efficiency | Terpenes | CBN Risk | Oxygen |
|--------|----------|------------|------------|----------|----------|--------|
| Sous Vide — Dry | 95 | 90–120 | 0.95–0.98 | High retention | Low | Minimal |
| Sous Vide — Combined | 85 | 240–360 | 0.85–0.92 | Moderate retention | Low | Minimal |
| Sous Vide — Fast | 95 | 120–180 | 0.95–0.98 | Moderate retention | Low | Minimal |
| Sous Vide — Low Temp | 73 | 480–720 | 0.60–0.75 | Very high retention | Very low | Minimal |
| Oven — Sealed Container | 113 | 60–90 | 0.90–0.95 | Moderate retention | Moderate | Low |
| Oven — Open Air | 116 | 40 | 0.88–0.95 | Low retention | High | High |

**Carrier fats**

| Fat | Extraction Efficiency | Simplified Multiplier | Notes |
|-----|----------------------|----------------------|-------|
| Ghee | 0.85 | 7.45 | Clarified butter, high smoke point |
| Coconut Oil | 0.82 | 7.19 | High MCT content, solid at room temp |
| MCT Oil | 0.92 | 8.07 | Fractionated, neutral flavor, liquid |
| Custom | user-defined | N/A | Manual efficiency entry |

## License

MIT

## Disclaimer

All calculations are heuristic estimates, not laboratory results. Actual potency varies with material quality, decarboxylation technique, measurement accuracy, and extraction conditions. Always verify with professional lab testing when precision is required.
