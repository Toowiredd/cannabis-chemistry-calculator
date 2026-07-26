# User-Story Audit — Action Plan

_Generated 2026-07-26 by /userstory-audit. Companion to USER_STORY_REGISTER_2026-07-26.md + USER_STORY_VALIDATION_2026-07-26.md._

This turns the 8 high/medium defects, the 1 missing roadmap item, and the 9 engine-orphan refactor candidates into a prioritized fix plan. Each item is a concrete code change with file:line evidence and a clear "done" definition.

---

## Priority 1 — High-severity defects (3)

### 1.1 Fix `electron-app-framework-lazy-window-ipc` (high, partial)

**Story:** A renderer can request a window over an `ipcMain.handle` channel, created on demand, reused on repeat calls, torn down when closed.

**Current state:** `src/lib/electron-app/factories/ipcs/register-window-creation.ts:5-22` exists with correct closure logic (create → reuse → null on 'closed') but **zero callers**. Every `ipcMain.handle` in `src/main/windows/main.ts:95-128-146-200-260-293-340-363-379-403` is a direct call (clipboard, journal, strains, etc.) — none register a window-creation channel.

**Fix:**
1. Add `registerWindowCreationByIPC({id, createWindow, preload})` to `src/main/index.ts:12-20` immediately after `makeAppSetup`.
2. Register a single `'window:create-request'` channel in `main.ts` and route through the factory.
3. Expose `window.App.requestWindow(id)` from `src/preload/index.ts:33-34`.
4. Add a test in `src/main/windows/__tests__/main.security.test.ts` covering: first call → create, second call → reuse, closed → null.

**Done when:** A second `BrowserWindow` can be requested from the renderer (e.g. a "Open Journal in new window" or a "Documentation" window) without restarting the app.

### 1.2 Fix `renderer-shell-vertical-stacked-layout-drift` (high, drift_confirmed)

**Story (from validation_report.md:110,127,159,341):** All tab content sections render simultaneously in a vertically stacked layout.

**Current state:** Reality is a 3D `TabCarousel` (5 workflow faces) + flat `ReferenceStrip` (4 cards) composed by `GroupedTabNav` in `src/renderer/screens/main.tsx:324-405`. `src/renderer/src/components/TabCarousel.tsx:81` sets `VISIBLE_WINDOW=2`; lines 180 and 200 set `inWindow = absDist <= VISIBLE_WINDOW`; line 420 uses `shouldRender = t.inWindow` (gate at line 490) — at most 5 of 9 tabs are in the DOM.

**Fix (docs only — no code change needed):**
1. Edit `validation_report.md:110,127,159,341` to replace "vertically stacked layout where all tab content sections are rendered simultaneously on the same page" with the truthful description: "3D TabCarousel (5 workflow faces) + flat ReferenceStrip (4 cards); TabCarousel lazy-mounts faces outside active ± 2 (VISIBLE_WINDOW=2)."
2. Add an `Architecture` section near the top of `validation_report.md` that names `GroupedTabNav → TabCarousel + ReferenceStrip` and the `VISIBLE_WINDOW=2` lazy-mount contract.
3. Update the section at `validation_report.md:341` to remove any "all visible" claim.

**Done when:** No claim of vertical-stack / all-tabs-visible remains in `validation_report.md`; auditors reading the report understand the coverflow + strip + lazy-mount contract from the doc alone.

### 1.3 Fix `tabs-ui-cross-tab-unit-toggles` (high, drift_confirmed)

**Story (from orchestrator_brief.md:42):** Unit toggles for temperature, bag width/length in Decarb Advanced Settings, the wizard's fat picker, and the First-Timer Guide.

**Current state:** Only 2 of 4 claimed toggles exist:
- ✅ `InfusionTab.tsx:518` volume UnitToggle (4 options)
- ✅ `DecarbTab.tsx:1374` temperature UnitToggle (°C/°F)
- ❌ `DecarbTab` Advanced Settings has NO bag width/length input (only Temperature, Time, Efficiency)
- ❌ `FirstTimerGuide.tsx` has NO fat-volume UnitToggle (mL-only by design at line 1960) and NO temperature toggle (method cards at line 1876 hardcode `°C`)

**Decision needed:** Is the brief wrong, or is the gap a real miss?
- **If brief is wrong:** Update `orchestrator_brief.md:42` to drop the unbuilt claims.
- **If gap is real:** Add the missing inputs to `DecarbTab` Advanced Settings and `FirstTimerGuide` method cards.

**Fix (option A — defer unit toggles):**
1. In `DecarbTab.tsx`, keep Advanced Settings limited to Temperature/Time/Efficiency (current state).
2. In `FirstTimerGuide.tsx`, keep `°C` and `mL` hardcoded (current state, simpler wizard UX).
3. Update `orchestrator_brief.md:42` to list only `InfusionTab volume + DecarbTab temperature` as the unit-toggle surfaces. Note in the brief that the bag/fat volume unit toggles are intentionally deferred to a future iteration.

**Fix (option B — implement missing inputs):**
1. Add `bagWidthOverrideUnit` + `bagLengthOverrideUnit` UnitToggle to `DecarbTab` Advanced Settings, wired to `decarb.bagWidthOverrideUnit` + `bagWidthOverride` set via `setDecarb`.
2. Add a `tempUnit` UnitToggle to `FirstTimerGuide.tsx:1874` method cards.
3. Defer fat-volume UnitToggle (mL-only is fine for cooking precision).

**Done when:** `orchestrator_brief.md:42` matches the codebase reality (option A) OR all claimed unit toggles are wired (option B).

---

## Priority 2 — Medium-severity defects (5)

### 2.1 Wire `engine-decarb-input-warning` (medium, partial)

**Story:** "Double-check your lab" warning when THCA+THC or CBDA+CBD exceeds 40%.

**Current state:** `getDecarbWarnings` at `src/renderer/src/engine/schemas.ts:139-156` produces the high-cannabinoid advisory. `src/renderer/src/engine/validation.ts:93, 174` also flags it. **No UI consumer.**

**Fix:**
1. In `DecarbTab.tsx:86-198`, extend `validateDecarbFields` to surface `getDecarbWarnings(decarb)` (cannabinoid > 40% advisory) as a non-blocking toast or inline alert above the input grid.
2. Use the existing `useToast` hook (not a new component).
3. Style: amber, dismissable, persists until the user edits a percentage or the input drops below 40%.
4. Add a unit test in `__tests__/validation.test.ts` (or extend `schemas.test.ts:170, 184`) asserting the warning fires on input with thcaPct=42 and stays silent on thcaPct=30.

**Done when:** User types `thcaPct=42` in DecarbTab and sees the advisory in ≤300ms.

### 2.2 Surface `engine-thc-degradation-kinetics` (medium, partial)

**Story:** Long-term storer wants to know how much THC their product loses at their storage temperature.

**Current state:** `src/renderer/src/engine/degradation.ts:59-63, 77, 97, 116, 148` is fully implemented and import-clean. **No UI consumer** (no Storage tab yet).

**Fix:**
1. Add a "Storage" tab to `GroupedTabNav.tsx` (workflow face #6, pushes Journal into the reference strip) OR a "Storage" sub-card in `ReferenceStrip.tsx`.
2. New `StorageTab.tsx` with: temperature input (°C/°F), days input, output = `simulateDegradation` from `degradation.ts:59`.
3. Display: initial THC mg → projected THC mg → % loss, with a small chart.
4. Persist the storage slice in `appStore.ts` (new `storage` slice, similar to `infusion`).

**Done when:** User opens the Storage tab, enters 22°C + 30 days, sees the projected THC loss.

**Scope warning:** This is a real new feature, not a 1-line fix. If not in current iteration, mark the story as `intentionally_deferred` and update the register/validation reports.

### 2.3 Add volume input to `tabs-ui-advanced-fat-comparison` (medium, partial)

**Story:** Fat Comparison sub-tab has volume + volume-unit toggles so users can see mg/mL output for each fat.

**Current state:** `AdvancedToolsTab.tsx:79-353` (Fats sub-tab) reads `infusion.volume / infusion.volumeUnit` (lines 107-108) but has no input. The mg/mL output is therefore only meaningful if the user pre-sets volume in the Infusion tab.

**Fix:**
1. Add a `volume + volumeUnit` input row at the top of Fats sub-tab (`AdvancedToolsTab.tsx:79-90`).
2. Wire to a local `FatsSection` state (ephemeral, not persisted — or extend `AdvancedToolsState.fats` slice in `appStore.ts:136`).
3. Optionally include a `Use This Volume in Infusion` button that calls `setInfusion({volume, volumeUnit})`.
4. Test: `__tests__/AdvancedToolsTab.test.tsx` (or new file) — setting volume=120, volumeUnit='mL' updates the per-fat mg/mL output.

**Done when:** Fats sub-tab has a working volume input that affects the per-fat comparison output.

### 2.4 Honor `tabs-ui-reduced-motion-respect` (medium, drift_confirmed)

**Story:** Unit-toggle transition + result-panel bloom animation respect `useReducedMotion`.

**Current state:** `DoseTab.tsx`, `InfusionTab.tsx`, `DecarbTab.tsx` do NOT import `useReducedMotion`. The hook is implemented at `src/renderer/src/hooks/useReducedMotion.ts:1-12` and used in `TabCarousel.tsx:444` and FirstTimerGuide, but not in the 3 calculator tabs.

**Fix:**
1. `DoseTab.tsx`: import `useReducedMotion` (from `../../hooks/useReducedMotion`), wrap the result-bloom div in a conditional class (`result-bloom` vs `result-bloom-static`).
2. Same for `InfusionTab.tsx` (if it has a result-bloom) and `DecarbTab.tsx`.
3. For unit-toggle transitions: add a class swap on the UnitToggle component when `prefers-reduced-motion: reduce` matches.
4. Add a `globals.css` rule: `@media (prefers-reduced-motion: reduce) { .result-bloom { animation: none; } .unit-toggle-transition { transition: none; } }` — this is a global CSS fallback that works even if individual components miss the hook.

**Done when:** With `prefers-reduced-motion: reduce` enabled in OS settings, the bloom and unit-toggle animations do not play; without it, they play normally.

### 2.5 Fix `tabs-ui-vertical-stacked-layout-drift` (medium, drift_confirmed)

**Story:** Same root cause as Priority 1.2 — `validation_report.md` claims vertical-stacked layout.

**Current state:** Same as 1.2. The 2026-07-25 coverflow + strip redesign is not reflected in the validation report.

**Fix:** Folded into Priority 1.2 — the validation_report.md rewrite covers this story too. No separate work needed.

---

## Priority 3 — Confirmed missing (1)

### 3.1 Wire `electron-app-framework-auto-updater` (missing)

**Story:** electron-updater + GitHub releases for in-app update notifications.

**Current state:** `DESIGN.md:475` marks it roadmap. No `electron-updater` or `updateElectronApp` dep in `package.json`. No updater code anywhere.

**Fix:**
1. `pnpm add electron-updater`.
2. Wire in `src/main/index.ts` after the window is ready: `autoUpdater.checkForUpdatesAndNotify()`.
3. Add `publish` block to `electron-builder.ts` (GitHub provider, owner/repo from `extractOwnerAndRepoFromGitRemoteURL`).
4. Handle the `update-available` / `update-downloaded` events with a `dialog.showMessageBox` prompt to restart.
5. Add `electron-updater` to `trusted-dependencies-scripts.json` (electron-vite externalization).

**Done when:** Pushing a new GitHub release causes a "Restart to update" dialog on existing user installs.

**Scope warning:** This requires a release-test cycle; defer to a dedicated iteration. Update the story status to `roadmap_planned_with_target_<date>` once scheduled.

---

## Priority 4 — Refactor candidates (engine orphans, no doc claim, no functional gap)

These don't break anything but represent dead code or inlined logic that the engine surface is ready to absorb.

| ID | What to do | Effort |
|---|---|---|
| `engine-cbd-decarb-range` | Replace `DecarbTab.tsx:618-620` inlined math with `calculateCbdRange(cbda.ts:80)` call. Saves ~3 lines + a class of drift risk. | 30 min |
| `engine-avb-theoretical-max` | Delete `calculateAvbTheoreticalMaxFromColor` at `decarb.ts:220` (no consumer). | 5 min |
| `engine-bag-volume` | Delete `calculateBagVolume` at `bagVolume.ts:69` (no consumer, presets have pre-computed volumeCm3). | 5 min |
| `engine-lab-text-strict-parser` | Keep `parseLabTextStrict` for future batch-mode import. Document in DESIGN.md or move to `engine/_future/`. | 10 min |
| `engine-recipe-save-load` | Keep for future Recipe import/export UI (likely a Dashboard feature). Same — document and shelve. | 10 min |
| `engine-recipe-format-name-lookup` | Delete `formatName` at `recipeScoring.ts:225` (no consumer — `RecipeData.name` carries the friendly name). | 5 min |
| `engine-reverse-decarb` | Keep for any future decarb-only reverse flow. Document and shelve. | 10 min |
| `engine-wizard-recipe-lookups` | Keep all 4 lookups (`getWizardRecipe`, `getDecarbMethodCard`, `getFatCard`, `suggestionsForRecipe`) — they're the cleanest id-based API surface. Document as the public engine API. | 15 min |
| `components-glass-card` | Delete or wire — the `glass-strong` etc. classes are inlined everywhere; the primitive is unused. Either commit to it (refactor 4-5 tabs to use `<GlassCard>`) or delete. | 1 hour to wire, 2 min to delete |

**Done when:** Each row is either (a) deleted with a commit message, (b) refactored to remove inlined duplication, or (c) marked as future-API with a `// FUTURE-API:` comment pointing to DESIGN.md.

---

## Priority 5 — Other low-severity partials (4)

| ID | Domain | What | Effort |
|---|---|---|---|
| `components-timer-widget` | components | Timer.tsx shows all DECARB_METHODS as separate start buttons; should pre-fill from active `decarb.presetId`. | 1 hour |
| `components-glass-card` | components | (also in Priority 4) |  |
| `components-alert-ui-primitive` | renderer-shell | `src/renderer/components/ui/alert.tsx` shadcn primitive has zero consumers. Delete or wire into form errors. | 30 min wire / 1 min delete |
| `tabs-ui-journal-log-from-calculator` | tabs-ui | "Log to Journal" button is on Journal tab, not Dose tab. Either move the button or update the orchestrator_brief wording. | 30 min |

---

## Suggested execution order

1. **Today (1-2 hrs):** Priority 1.2 + 2.5 (validation_report.md rewrite — docs only, unblocks future audits)
2. **Tomorrow (1-2 hrs):** Priority 2.1 (decarb-input-warning) + 2.4 (reduced-motion CSS) — small, high-leverage UX wins
3. **Next sprint:** Priority 1.3 (cross-tab unit toggles — pick option A or B in standup) + 2.3 (fat comparison volume input) + Priority 5 timer preset
4. **Future:** Priority 1.1 (lazy-window-ipc) + 3.1 (auto-updater) — need release-test cycle
5. **Backlog:** Priority 4 refactors — bundle into a "tech debt day" or feature work that touches the same files

---

## Total estimated effort

| Priority | Items | Effort |
|---|---|---|
| P1 (high) | 3 | ~3 hrs (1 of which is docs only) |
| P2 (medium) | 4 active + 1 fold-into-1.2 | ~4-6 hrs |
| P3 (missing) | 1 | ~3-4 hrs (incl. release test) |
| P4 (refactor) | 9 | ~2 hrs |
| P5 (low) | 4 | ~2 hrs |
| **Total** | **~20 items** | **~15-17 hrs** |

---

## Final stats (verdicts by category)

| Verdict | Count | % of 232 |
|---|---|---|
| ✅ complete | 203 | 87.5% |
| ⚠ partial | 9 | 3.9% |
| ↩ reclassified | 12 | 5.2% |
| ↔ drift_confirmed | 7 | 3.0% |
| ✗ missing | 1 | 0.4% |
| **Total** | **232** | **100%** |

**Complete rate by domain:** engine 94% · store-state 100% · main-electron 89% · tabs-ui 87% · components 82% · renderer-shell 85% · electron-app-framework 64%.

The electron-app-framework domain's lower rate is driven by the auto-updater roadmap item (P3.1) and the lazy-window-ipc dead factory (P1.1) — both are infrastructure-not-yet-used rather than regressions.
