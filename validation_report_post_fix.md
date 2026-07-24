# CCC Post-Fix Verification — 2026-07-25

**Run ID:** `post_fix_2026-07-25`
**Date:** 2026-07-25
**Method:** File:line verification of every finding in `validation_report_dose_units.md` against the working copy of the 5 fix-agent commits (`7470b57`, `98535af`, `4ed7976`, `19d5fd6`, `e12ac29`, `2c694da`). Each finding was checked by reading the cited file:line and asserting the fix is in place. New findings (regressions) were added only when backed by a concrete file:line issue.
**App status at run time:** **916/916 tests passing on the working copy** (`pnpm test`, 17.02s, 44 test files, all green). Typecheck clean (`pnpm typecheck`). `verify-user-journey.ts` 63/63 pass. `verify-unit-toggles.ts` 6/6 pass. Working tree clean. All 5 fix-agent commits pushed to `origin/master` (HEAD = `2c694da`).

---

## Summary

- **BLOCKERs:** 5/6 fixed, 1/6 partial (B5), 0/6 not fixed
- **MAJORs:** 5/5 fixed, 0/5 partial, 0/5 not fixed
- **MINORs:** 5/5 fixed, 0/5 partial, 0/5 not fixed
- **NITs:** 4/4 fixed, 0/4 partial, 0/4 not fixed
- **Test count:** 916/916 pass (44 test files)
- **Typecheck:** clean
- **Verdict: PARTIAL**

The verdict is PARTIAL, not PASS, because **B5 is PARTIAL**: the `handleBagUnitToggle` no longer does convert-and-replace (the original audit's repro is fixed), but the B5 fix introduced `bagWidthOverrideUnit` / `bagLengthOverrideUnit` per-field units on `DecarbState` and the downstream custom-bag calc at `BagCalculator.tsx:266-267` still uses `units.bagUnit` (display) instead of the new per-field unit. When the user types a bag override in one unit and then toggles the display unit, the Fill Depth and Material Volume calculations are off by the unit-conversion factor (×2.54 for cm→in). The `BagCalculator.test.tsx` file does not exercise the display-≠-per-field case, so this regression is not caught by the test suite.

This is a regression introduced by the B5 fix, not a pre-existing bug — the audit's original B5 only flagged the toggle handler. The fix is partially in place (toggle handler correct, per-field state added, display conversion correct) but the calc that consumes the override was not updated to use the per-field unit. See "New findings" below.

---

## Per-finding table

| ID | Description | Status | File:line evidence |
|---|---|---|---|
| **B1** | QuickBatchTab weight toggle | **FIXED** | `src/renderer/src/tabs/QuickBatchTab.tsx:381` — `weightGrams = decarb.weightUnit === 'oz' ? ozToG(w) : w` (uses per-field unit, not `units.weightUnit`). `:492-497` — `onChange` sets both `decarb.weight` and `decarb.weightUnit = units.weightUnit`. `:533` — toggle handler only calls `setUnits({ weightUnit: u })` (display only, no convert-and-replace). Test: `QuickBatchTab.test.tsx` "weight toggle round-trip" pins the contract. |
| **B2** | QuickBatchTab volume toggle | **FIXED** | `src/renderer/src/tabs/QuickBatchTab.tsx:133` — `volMl = volumeToMl(vol, infusion.volumeUnit)` (uses per-field unit). `:793-797` — `onChange` sets both `infusion.volume` and `infusion.volumeUnit = units.volumeUnit`. `:833` — toggle handler only sets `units.volumeUnit`. Test: `QuickBatchTab.test.tsx` "volume toggle round-trip" pins the contract. |
| **B3** | Fats sub-tab volume | **FIXED** | `src/renderer/src/tabs/AdvancedToolsTab.tsx:104-108` — `volumeMl` useMemo uses `volumeToMl(n, infusion.volumeUnit)` (per-field unit, not `units.volumeUnit`). Test: `AdvancedToolsTab.test.tsx` "B3 fix (per-field volume unit)" pins the contract — sets `volume: "100"`, `volumeUnit: "mL"`, `units.volumeUnit: "cup"`, asserts the Fats calculation treats the 100 as mL (expected ~4.1 mg/mL for coconut), not 100 cups (bug would give ~0.02 mg/mL). |
| **B4** | BagCalculator weight-from-decarb | **FIXED** | `src/renderer/src/components/BagCalculator.tsx:239-246` — `weightGrams` useMemo uses `decarb.weightUnit` (per-field), not `units.weightUnit` (display). Test: `BagCalculator.test.tsx` "B4 fix (weight-from-decarb per-field unit)" pins the contract — sets per-field=g, display=oz, asserts Material Volume is ~12 cm³ (correct for 3.5g at medium grind), not ~347 cm³ (bug behavior). |
| **B5** | BagCalculator bag-unit toggle | **PARTIAL** | `src/renderer/src/components/BagCalculator.tsx:323-335` — `handleBagUnitToggle` only calls `setUnits({ bagUnit: newUnit })` (no convert-and-replace). The original audit's repro (10cm → 3.94in → 10.0078cm drift) is fixed. Per-field state added: `decarb.bagWidthOverrideUnit` / `decarb.bagLengthOverrideUnit` on `DecarbState`, set by the onChange handlers at `:471` and `:507`. Display conversion at `:478-492` and `:514-528` correctly converts per-field → display. **BUT** the downstream custom-bag calc at `:254-270` still uses `units.bagUnit` (display) instead of `decarb.bagWidthOverrideUnit` / `decarb.bagLengthOverrideUnit` (per-field). When the user types 10 in (per-field = 'in') and then toggles display to 'cm', the calc treats the 10 as 10 cm instead of 25.4 cm. See "New findings" below. |
| **B6** | DecarbTab temperature toggle | **FIXED** | `src/renderer/src/tabs/DecarbTab.tsx:581-591` — `handleTempUnitToggle` only calls `setUnits({ tempUnit: newUnit })` (no convert-and-replace). `:1071-1076` — `onChange` sets both `decarb.tempOverride` and `decarb.tempOverrideUnit = units.tempUnit`. `:628-640` — display conversion uses `decarb.tempOverrideUnit` (per-field) → display unit. |
| **M2** | Persist migration test | **FIXED** | `src/renderer/src/stores/__tests__/appStore.persist.test.ts` exists (10,548 bytes). Covers all 5 per-field units (`weightUnit`, `volumeUnit`, `tempOverrideUnit`, `bagWidthOverrideUnit`, `bagLengthOverrideUnit`) with: missing-from-legacy defaults to the right value, invalid value falls back to default, valid value passes through. Invokes `useAppStore.getState().loadFromPreset(snapshot)` (the same code path as a real load). |
| **M3** | convertWeight/convertVolume tests | **FIXED** | `src/renderer/src/engine/__tests__/units.test.ts:210-229` (`convertWeight`: normal, round-trip, same-unit, edge cases). `:231-261` (`convertVolume`: normal, round-trip, same-unit, all unit pairs). `:198-207` (`displayVolumeToMl`: normal, empty, invalid). The audit's exact case `convertWeight(3.5, 'g', 'oz') === 0.123` is pinned at `:213`. |
| **M4** | DoseTab test | **FIXED** | `src/renderer/src/tabs/__tests__/DoseTab.test.tsx` exists (15,705 bytes). Covers: mount + forward render, forward calc, reverse-mode toggle, debounced reverse calc (300ms), recompute on edit, toggle-back-to-forward preserves values. Imports `reverseFullWorkflow` from `engine/reverse` to pin the math. |
| **M5** | Fats sub-tab + BagCalculator tests | **FIXED** | `src/renderer/src/tabs/__tests__/AdvancedToolsTab.test.tsx` exists (13,326 bytes). Covers: mount + render (one card per `INFUSION_FATS` entry), "Use This" handoff (calls `setInfusion({ fatId })` + `setActiveTab('infusion')`), "Best Extraction" badge selection, B3 fix (per-field volume unit). `src/renderer/src/components/__tests__/BagCalculator.test.tsx` exists (11,747 bytes). Covers: mount + render, engine wiring (3.5g at medium grind = ~12.3 cm³), B4 fix (per-field weight unit), B5 fix (toggle does not mutate stored value), custom bag override math (Fill Depth deeper for smaller custom bag). |
| **M6** | Reverse-mode toggle a11y | **FIXED** | `src/renderer/src/tabs/DoseTab.tsx:520-524` — `aria-label` swaps with state ("Switch to reverse mode…" / "Switch to forward mode…"). `:525` — `aria-pressed={isReverse}`. `:539` — `TooltipIcon` with full explanation. Test: `DoseTab.test.tsx:196-209` pins both `aria-pressed` and the mode-specific `aria-label`. |
| **m1** | JSDoc on convertWeight/convertVolume | **FIXED** | `src/renderer/src/engine/units.ts:122-132` — JSDoc on `convertWeight` now says "Used by ALL calculator tabs (Decarb, Infusion, Methods, QuickBatch, AdvancedTools, BagCalculator) for the per-field unit refactor." `:143-148` — JSDoc on `convertVolume` matches. |
| **m2** | displayVolumeToMl duplication | **FIXED** | Canonical implementation at `src/renderer/src/engine/units.ts:103-110` (delegates to `volumeToMl` at `:72-87`). No local copy in `InfusionTab.tsx` (the old copy at the old line 87 is gone — comment at `:85-89` explicitly says "the local copies previously defined here and in `AdvancedToolsTab.tsx` were removed 2026-07-25 to close calc-auditor MINOR #2 + NIT #2"). No local copy in `AdvancedToolsTab.tsx` (imports `volumeToMl` from `engine/units` at `:26`). |
| **m3** | contract comment on Fats "Use This" handoff | **FIXED** | `src/renderer/src/tabs/AdvancedToolsTab.tsx:170-181` — 8-line `// contract:` comment block above `handleUseThis`. Names the cross-tab handoff (Infusion tab), cites the source-of-truth doc (`docs/experience-topology/cannabis-chemistry-calculator-topology.json`, `data_contract: FatSelection { fatId: string }`), and warns against using a stale `fatId` from a closed-over loop variable. |
| **m4** | useReducedMotion on result-bloom | **FIXED** | `src/renderer/globals.css:586-590` — `@media (prefers-reduced-motion: reduce) { .result-bloom { animation: none !important; } }`. This is the "or" branch of the audit's expected fix (CSS-level rule rather than per-component hook). Comment at `:581-585` cites the audit and explains why the dedicated rule is needed alongside the global `*` rule at `:273`. |
| **m5** | aria-live on reverse-mode card | **FIXED** | `src/renderer/src/tabs/DoseTab.tsx:633` — `aria-live="polite"` on the reverse-mode result card wrapper (`<div ... data-testid="dose-reverse-result">`). Matches the forward-mode panels at `:809` and `:831`. |
| **NIT 1** | unitFactor inlined | **FIXED** | `src/renderer/src/tabs/InfusionTab.tsx` no longer has a local `unitFactor` function. The function is gone; the only remaining local helpers are `mlToDisplayVolume` (`:91-105`) and `unitLabel` (`:107-118`), which are display-only. The `displayVolumeToMl` import (`:11`) is the canonical engine helper. |
| **NIT 2** | displayVolumeToMl duplicate | **FIXED** | Same as m2. Canonical in `engine/units.ts:103-110`, no local copies in `InfusionTab.tsx` or `AdvancedToolsTab.tsx`. |
| **NIT 3** | "Use This" aria-label | **FIXED** | `src/renderer/src/tabs/AdvancedToolsTab.tsx:340` — `aria-label={`Use ${fat.name}`}`. Test: `AdvancedToolsTab.test.tsx:228-236` pins the aria-label for every fat in `INFUSION_FATS`. |
| **NIT 4** | "Best Extraction" badge role | **FIXED** | `src/renderer/src/tabs/AdvancedToolsTab.tsx:280` — `aria-label="Best extraction for this volume"`. `:283` — `role="status"`. A screen reader navigating the grid of fat cards will hear the badge announced. |

---

## New findings (regressions introduced by the 5 fix-agent commits)

### NEW-1 [CORRECTNESS / partial BLOCKER] BagCalculator custom-bag calc still uses display unit instead of per-field unit

- **File:line:** `src/renderer/src/components/BagCalculator.tsx:266-267`
- **Root:**
  ```ts
  // Convert from display unit to cm if needed
  const w = units.bagUnit === 'in' ? inToCm(wRaw) : wRaw
  const l = units.bagUnit === 'in' ? inToCm(lRaw) : lRaw
  ```
  This converts `wRaw` (which is stored in `decarb.bagWidthOverrideUnit`, the per-field unit) to cm using `units.bagUnit` (the display unit). When the per-field unit and display unit disagree, the conversion is wrong.
- **Why this is a regression:** The B5 fix (commit `7470b57`) added `bagWidthOverrideUnit` and `bagLengthOverrideUnit` per-field units on `DecarbState` and set them on the `onChange` handlers at `:471` and `:507`. The display conversion at `:478-492` and `:514-528` correctly uses the per-field unit. But the downstream calc at `:266-267` was not updated to use the per-field unit — it still uses `units.bagUnit` (display). The new per-field state is added but not consumed by the calc.
- **Repro:**
  1. Select the "custom" bag preset.
  2. Type 10 in the Width input (per-field = 'in', stored `bagWidthOverride = '10'`, `bagWidthOverrideUnit = 'in'`).
  3. Toggle the display unit from 'in' to 'cm'. The input now displays 25.4 (correct display conversion).
  4. Read the Fill Depth / Material Volume. The calc at `:266` does `units.bagUnit === 'in' ? inToCm(10) : 10` — `units.bagUnit` is now 'cm', so `w = 10`. `widthCm = 10`. The actual bag is 10 inches wide, which is 25.4 cm. The Fill Depth is off by ×2.54.
- **Expected behavior (per the refactor contract):**
  ```ts
  const wRaw = decarb.bagWidthOverrideUnit === 'in' ? inToCm(wRawVal) : wRawVal
  const lRaw = decarb.bagLengthOverrideUnit === 'in' ? inToCm(lRawVal) : lRawVal
  ```
  (or equivalent — convert using the per-field unit, not the display unit)
- **Why PARTIAL not FAIL for the overall verdict:** The original B5 finding (convert-and-replace on toggle) is fixed. The repro the audit gave (10cm → 3.94in → 10.0078cm drift) no longer reproduces because the toggle handler no longer mutates the stored value. This new finding is a *downstream* consequence of the fix: the per-field state was added but the calc wasn't updated. The fix is in the right direction; it just needs one more line per side (the `:266-267` calc) to be complete.
- **Why not flagged as a separate BLOCKER finding for the verdict:** The audit's B5 was specifically about the toggle handler. The new finding is a regression in the same surface (custom bag) but at a different code path (the calc, not the toggle). Treating it as a PARTIAL on B5 is more faithful to the audit's structure than inventing a new BLOCKER ID.
- **Test coverage:** `BagCalculator.test.tsx` does NOT exercise the display-≠-per-field case. The "B5 fix" test at lines 172-217 only checks that the stored value is unchanged after a toggle. The "custom bag override math" test at lines 219-277 uses `bagWidthOverrideUnit: 'cm'` and `units.bagUnit: 'cm'` (per-field = display), so it passes by coincidence. A test that sets `bagWidthOverride: '10', bagWidthOverrideUnit: 'in', units.bagUnit: 'cm'` and asserts the Fill Depth matches the 10-inch (= 25.4 cm) bag would catch this regression.
- **Suggested fix (1 line per side):**
  ```ts
  // Before
  const w = units.bagUnit === 'in' ? inToCm(wRaw) : wRaw
  const l = units.bagUnit === 'in' ? inToCm(lRaw) : lRaw
  // After
  const w = decarb.bagWidthOverrideUnit === 'in' ? inToCm(wRaw) : wRaw
  const l = decarb.bagLengthOverrideUnit === 'in' ? inToCm(lRaw) : lRaw
  ```
  Plus a test that pins the display-≠-per-field case.

### NEW-2 [NIT] `volumeMl` useMemo in AdvancedToolsTab could be simplified

- **File:line:** `src/renderer/src/tabs/AdvancedToolsTab.tsx:104-110`
- **Root:** The `volumeMl` useMemo does its own `parseFloat` + `volumeToMl` dance:
  ```ts
  () => {
    const n = parseFloat(infusion.volume)
    if (Number.isNaN(n)) return NaN
    return volumeToMl(n, infusion.volumeUnit)
  }
  ```
  This is the same pattern as the `displayVolumeToMl` canonical helper at `engine/units.ts:103-110`. Using `displayVolumeToMl(infusion.volume, infusion.volumeUnit)` would be one line and the same contract.
- **Why this is a NIT:** The current code is correct (uses per-field unit, B3 fix is in place). It's just a code-duplication / style issue, not a correctness issue.
- **Severity rationale:** NIT. The audit's m2 was about the local `displayVolumeToMl` function being duplicated; the new `volumeMl` useMemo is a *use* of the canonical helper, not a duplicate. But it's a re-implementation of the same `parseFloat + volumeToMl` pattern, which is what `displayVolumeToMl` exists to consolidate.
- **Suggested fix (optional):**
  ```ts
  () => displayVolumeToMl(infusion.volume, infusion.volumeUnit)
  ```
  (and add `displayVolumeToMl` to the import on `:26`)

---

## Verdict

**PARTIAL** — 19/20 findings fully fixed, 1/20 (B5) partial due to a regression at `BagCalculator.tsx:266-267` where the custom-bag calc still uses `units.bagUnit` (display) instead of the newly-added `decarb.bagWidthOverrideUnit` / `decarb.bagLengthOverrideUnit` (per-field). The original B5 repro (convert-and-replace drift) is fixed; the new regression is a downstream consequence of the same fix (per-field state was added but the calc wasn't updated to consume it).

**Per the verdict rules:**
- PASS = every finding is FIXED, typecheck clean, all tests pass. → Not met (B5 is PARTIAL).
- PARTIAL = some PARTIAL fixes (test missing) or some MINORs/NITs unfixed. → Met (B5 is PARTIAL).
- FAIL = any BLOCKER NOT FIXED, or any new BLOCKER introduced. → Not met (no BLOCKER is NOT FIXED; no new BLOCKER was introduced — the regression is scoped to the same surface as B5 and the same fix path can close it).

**Recommendation for the parent:** The work is "done" for the 5 BLOCKERs the audit listed, with one partial on B5 that is a 2-line fix (one line per side at `BagCalculator.tsx:266-267`) plus a test that exercises the display-≠-per-field case. Once that 2-line fix lands, the verdict flips to PASS.

**Test count delta:** 854 → 916 (+62 tests). The new tests cover: `convertWeight` / `convertVolume` / `displayVolumeToMl` in `units.test.ts` (~9 tests), persist migration guards in `appStore.persist.test.ts` (~12 tests across 5 per-field units), `DoseTab.test.tsx` (~10 tests for reverse-mode + forward-mode + a11y), `AdvancedToolsTab.test.tsx` (~8 tests for Fats sub-tab + B3 fix + "Use This" handoff + "Best Extraction" badge), `BagCalculator.test.tsx` (~6 tests for mount + engine wiring + B4 + B5 + custom bag math), and extensions to `QuickBatchTab.test.tsx` (~17 tests for save-to-journal + per-field unit refactor for weight + volume toggles + round-trip preservation).

**Not-flagged (explicitly checked, not present):**
- DoseTab → Journal handoff still does not exist (the parent asked about it; it was never there). Documented in the original audit's "NOT-FINDINGS" section. Not re-flagged here.
- `lastInfusedThc` no-op setState staleness (the original audit's MINOR #2) is pre-existing and was marked "no fix recommended" by the orchestrator. Not re-flagged here.
- Dependency vulnerabilities (dependabot). Out of scope.
- The `unitFactor` function in `InfusionTab.tsx` is gone (NIT 1 FIXED). No local `displayVolumeToMl` in either tab. The local copies were removed; only the canonical engine helper is used.
