# User-Story Validation Report

_Generated 2026-07-26 by /userstory-audit — adversarial, code-grounded._

## Summary

| Verdict | Count |
|---|---|
| ✅ complete | 203 |
| ⚠ partial | 9 |
| ✗ missing | 1 |
| ↔ drift_confirmed | 7 |
| ↩ reclassified | 12 |

**runtimeProofNeeded:** 154

### Complete rate by domain

| Domain | Complete | Total |
|---|---|---|
| components | 27 | 33 |
| electron-app-framework | 14 | 22 |
| engine | 66 | 70 |
| main-electron | 8 | 9 |
| renderer-shell | 11 | 13 |
| store-state | 23 | 23 |
| tabs-ui | 54 | 62 |

## High / medium-severity defects (8)

| Sev | Domain | id | Verdict | Gap |
|---|---|---|---|---|
| high | electron-app-framework | `electron-app-framework-lazy-window-ipc` | partial | No caller wires the factory into a real channel; the IPC channel a renderer would invoke to create a window on demand is never registered. Story claims a runtim |
| high | renderer-shell | `renderer-shell-vertical-stacked-layout-drift` | drift_confirmed | validation_report.md misrepresents the layout as vertically stacked with all tabs visible. Reality: 3D TabCarousel (5 workflow faces) + flat ReferenceStrip (4 c |
| high | tabs-ui | `tabs-ui-cross-tab-unit-toggles` | drift_confirmed | DecarbTab Advanced Settings has no bag width/length input (claim from orchestrator_brief.md:42 is false). FirstTimerGuide has no fat-volume unit toggle (mL-only |
| medium | engine | `engine-decarb-input-warning` | partial | No UI consumer: the high-cannabinoid advisory never surfaces to the user. Both schemas.ts:139 and validation.ts:93 are unwired. |
| medium | engine | `engine-thc-degradation-kinetics` | partial | No UI consumer. Engine module is import-clean and ready for a future Storage tab, but the 'as a long-term storer' user cannot reach this from the app today. |
| medium | tabs-ui | `tabs-ui-advanced-fat-comparison` | partial | No volume input or volume-unit toggle UI is rendered inside the Fats sub-tab. The user can only see volume-based mg/mL output if they set volume in the Infusion |
| medium | tabs-ui | `tabs-ui-reduced-motion-respect` | drift_confirmed | src/renderer/src/tabs/DoseTab.tsx, InfusionTab.tsx, and DecarbTab.tsx do not import or use useReducedMotion; the .result-bloom animation and unit-toggle transit |
| medium | tabs-ui | `tabs-ui-vertical-stacked-layout-drift` | drift_confirmed | validation_report.md describes a monolithic prototype where all 7 sections are simultaneously rendered; the actual implementation is a 3D cylindrical coverflow  |

## Confirmed MISSING — roadmap candidates (1)

| Domain | id | Story |
|---|---|---|
| electron-app-framework | `electron-app-framework-auto-updater` | As a user, I want electron-updater wired into the release script with GitHub releases, so I get in-app update notificati |

## Full verdicts by domain

### components (27/33 complete)

| id | verdict | sev | gap/note |
|---|---|---|---|
| `components-decarb-heatmap` | ✅complete | none | Geometry (73-130°C, 17/26/14 flex ratios, boundary at 90/116°C), green/yellow/red zones, needle position, out-of-range w |
| `components-bag-calculator` | ✅complete | none | Grind level (line 432-454), bag preset + custom dims (line 456-555), headspace gauge (line 99-184, 599), double-bag reco |
| `components-molecular-builder` | ✅complete | none | useReducedMotion hook (line 37-51) with StaticDiagram fallback (line 124, rendered at 602-606), IntersectionObserver aut |
| `components-dose-radar-chart` | ✅complete | none | 6-axis SVG radar with 6 RADAR_AXES (line 284-297), animated polygon via useAnimatedScores (line 32-83, 343-366), empty s |
| `components-smart-suggest-panel` | ✅complete | none | 4-card grid (brownies/gummies/capsules/tincture icons at line 23-28, grid at 303-352) with 'BEST MATCH' badge on top sco |
| `components-label-generator` | ✅complete | none | Configurable fields (productName, ingredients, allergens via store, classification prop), printable modal (line 288-450) |
| `components-strain-manager` | ✅complete | none | Modal CRUD with name/type/THCA/THC/CBDA/CBD/notes fields (line 246-358), globalStrainLibrary sync (line 122-128), window |
| `components-inventory-section` | ✅complete | none | Inline add/edit/delete with material-kind picker, AVB color residual-THC estimator (form.avbColor at line 121, picker at |
| `components-timer-widget` | ⚠partial | low | TimerWidget does not consume the active decarb preset (decarb.presetId); instead it shows all DECARB_METHODS as individu |
| `components-title-bar` | ✅complete | none | Draggable region via app-region-drag class (line 39), theme toggle wired to useAppStore.toggleTheme (line 49-65), Preset |
| `components-grouped-tab-nav` | ✅complete | none | Composes TabCarousel (5 workflow faces) + NextIndicator (chevron with default next-step map at line 94-104) + ReferenceS |
| `components-tab-carousel` | ✅complete | none | N-face 3D cylinder via computeFaceTransforms (line 159-203) with wrapIndex for circular wrap (line 88-91), reduced-motio |
| `components-reference-strip` | ✅complete | none | ReferenceStrip renders 4 cards (Methods/Advanced/Knowledge/Journal) with icon, label, and 2-bullet preview. Active card  |
| `components-transformation-canvas` | ✅complete | none | 6x6 grid (COLS=6, ROWS=6 at lines 47-48), 4 stages ('landing'\|'decarb'\|'infusion'\|'dose' at line 8), full-screen SVG  |
| `components-preset-actions` | ✅complete | none | Save/Load buttons at lines 258-277. Save-name modal at lines 280-354 with title 'Save Preset' and useModalA11y hook. Los |
| `components-toast` | ✅complete | none | ToastVariant union at line 5 has all 5 variants (default/success/warning/danger/info). ARIA live region at line 53: aria |
| `components-tooltip-icon` | ✅complete | low | TooltipIcon at lines 1-41 implements (i) icon (Info, line 26) with popover (role='tooltip', line 34). Hover via onMouseE |
| `components-tab-actions` | ✅complete | none | TabActions component at lines 10-104 implements Export Report button (lines 74-83) and Copy Summary button (lines 84-99) |
| `components-startup-chooser` | ✅complete | none | 3 intent cards (make_batch, resume_repeat, history_learn) at lines 18-45 with icon + label + description. Confidence lab |
| `components-use-modal-a11y` | ✅complete | none | Hook at lines 20-92 implements all 4 contracts: (1) Escape-to-close via document keydown listener (lines 51-79), (2) bod |
| `components-use-reduced-motion` | ✅complete | low | Hook at lines 1-12 returns boolean from matchMedia('(prefers-reduced-motion: reduce)') and re-renders on change via addE |
| `components-platform-bootstrap` | ✅complete | none | bootstrap.ts at lines 26-52: isElectronContext() (lines 26-37) checks for window.App.exportReport function presence; ens |
| `components-platform-web-shim` | ✅complete | none | webApp object at line 333 implements the full IPC surface: exportReport (line 341, Blob URL download), copyToClipboard ( |
| `components-platform-idb-store` | ✅complete | none | idb-store implements all 5 ops: openIdbStore (line 67, with caching and null-fallback on private mode/error), idbGet (li |
| `components-swipe-deck` | ✅complete | none | SwipeDeck.tsx is a complete 444-line 3-face implementation preserved unchanged. TabCarousel.tsx:33-35 explicitly notes ' |
| `components-lab-paste-field` | ✅complete | none | LabPasteField.tsx:1-119 implements the textarea+Apply button wired to parseLabText + looksLikeLabData from renderer/src/ |
| `components-glass-card` | ⚠partial | low | Component is implemented but has no production consumer. The glassmorphism language is achieved by inlining 'glass-stron |
| `components-input-row` | ✅complete | none | InputRow.tsx:1-30 implements a label/control/error row with role='alert' on the error span. It is heavily used: imported |
| `components-override-badge` | ✅complete | none | OverrideBadge.tsx is a 7-line pill with amber/warning styling (matching DESIGN.md:328-335 'Override Highlighting' sectio |
| `components-form-validation-on-calculator-inputs` | ↩reclassified | none | Tagged docs_only but the implementation is real and wired. DecarbTab.tsx:86-198 defines validateDecarbFields producing p |
| `components-inline-zod-validation` | ↩reclassified | none | Tagged docs_only but Zod validation is implemented. engine/schemas.ts:413-424 exports zodIssuesToFieldErrors as a Zod-is |
| `components-doneness-curve-slider` | ↩reclassified | low | No dedicated component file in components/. Implementation is inline in KnowledgeTab.tsx (tabs-ui domain) — refactor can |
| `components-responsive-constraints` | ↩reclassified | none | No component in scope — the constraint is enforced by the main-screen layout (main.tsx:325) and BrowserWindow minWidth/m |

### electron-app-framework (14/22 complete)

| id | verdict | sev | gap/note |
|---|---|---|---|
| `electron-app-framework-single-instance-lock` | ✅complete | none | instance.ts:1-7 wraps app.requestSingleInstanceLock(): if not primary, app.quit(); else runs the supplied setup fn. The  |
| `electron-app-framework-app-lifecycle-setup` | ✅complete | none | setup.ts:9-41 implements makeAppSetup that wires: 'activate' (line 12 — reuses or restores windows), 'web-contents-creat |
| `electron-app-framework-browser-window-factory` | ✅complete | none | create.ts:8-19 exports a createWindow({id, ...settings}) factory that constructs a BrowserWindow from settings, register |
| `electron-app-framework-lazy-window-ipc` | ⚠partial | high | No caller wires the factory into a real channel; the IPC channel a renderer would invoke to create a window on demand is |
| `electron-app-framework-package-json-prebuild` | ✅complete | none | prebuild.ts destructures out `main, scripts, resources, devDependencies` and writes the slim package.json plus the trust |
| `electron-app-framework-semver-release-script` | ✅complete | none | release.ts prompts for a new version (question, line 17), validates (checkValidations, line 21), writes the new version  |
| `electron-app-framework-cli-ansi-colors` | ✅complete | none | COLORS object defines ANSI escapes for red/green/cyan/gray/etc. and is consumed by release.ts and validations.ts to colo |
| `electron-app-framework-sync-shell-exec` | ✅complete | none | exec wraps `child_process.execSync` and supports the documented `inherit` flag (line 16 — `stdio: 'inherit' if inherit e |
| `electron-app-framework-git-remote-extractor` | ✅complete | none | extractOwnerAndRepoFromGitRemoteURL strips `git@github.com:` and `https://github.com/` prefixes and the trailing `.git`, |
| `electron-app-framework-dev-folder-resolver` | ✅complete | none | getDevFolder splits `dirname(path)` and returns the first two segments, so for `node_modules/.dev/main/index.mjs` it ret |
| `electron-app-framework-readline-question` | ✅complete | none | question() creates a node:readline interface over process.stdin/stdout and resolves with the typed answer. Consumed by r |
| `electron-app-framework-semver-release-validations` | ✅complete | none | checkValidations returns truthy (the error string `true` is returned, lines 15/23/31/39) on empty/non-semver/lower/equal |
| `electron-app-framework-console-warning-filter` | ✅complete | none | ignoreConsoleWarnings patches process.emitWarning with a closure-captured original and substring-filters by `warningsToI |
| `electron-app-framework-react-devtools-loader` | ✅complete | none | loadReactDevtools resolves the vendored extension path and calls `session.defaultSession.extensions.loadExtension(..., { |
| `electron-app-framework-electron-vite-build` | ↩reclassified | none | Marked docs_only but the build config is fully implemented. electron.vite.config.ts defines main (ESM, output `node_modu |
| `electron-app-framework-contextbridge-preload` | ↩reclassified | none | Preload script at src/preload/index.ts:9-34 exposes a small, explicit API (window minimize/maximize/close, exportReport, |
| `electron-app-framework-cdp-automation` | ✅complete | none | Electron exposes CDP by default at --remote-debugging-port; main.ts:421-424 opens detached DevTools in dev mode, and the |
| `electron-app-framework-pwa-preflight-validator` | ↩reclassified | none | scripts/validate-pwa.cjs is a real 260-line validator; counting static + per-icon track() calls gives ~20 checks with th |
| `electron-app-framework-pwa-host-tailscale-funnel` | ↩reclassified | none | scripts/serve-pwa.cjs binds 127.0.0.1:8765 (lines 36-37), handles SPA fallback, cache headers, and WMI parent-process in |
| `electron-app-framework-auto-updater` | ✗missing | none | No updater code anywhere in repo — confirmed future-state. Story priority is peripheral so this is expected. |
| `electron-app-framework-pwa-install-target` | ↩reclassified | none | vite.web.config.ts:71-107 declares the PWA manifest with display:'standalone', theme_color, background_color, 3 icons (1 |
| `electron-app-framework-pwa-tailscale-funnel-hosting` | ↩reclassified | none | vite.web.config.ts:162 sets base: '/ccc/' so every emitted asset URL is subpath-correct; the manifest id (line 72), scop |

### engine (66/70 complete)

| id | verdict | sev | gap/note |
|---|---|---|---|
| `engine-thc-decarbed-amount` | ✅complete | none | calculateTheoreticalMax (decarb.ts:23) and calculateDecarbedThc (decarb.ts:54) are exported with validation, the 0.877 T |
| `engine-infused-thc` | ✅complete | none | calculateInfusedThc at infusion.ts:17-33 implements decarbedThc × extractionEff with full input validation. InfusionTab. |
| `engine-mg-per-serving` | ✅complete | none | calculateMgPerServing at dosing.ts:17-30 divides finalThcMg by servings with validation. Consumed by DoseTab, QuickBatch |
| `engine-dose-classification` | ✅complete | none | classifyDose at dosing.ts:52 implements the 7-tier classification (sub-microdose / microdose / low / moderate / strong / |
| `engine-unit-conversion` | ✅complete | none | All 10 cited functions are present at the referenced line numbers (gToOz:7, cToF:17, mlToTsp:27, mlToTbsp:37, mlToCup:47 |
| `engine-format-number-display` | ✅complete | none | Note: validation target's annotation says "fmt1 at 82, round1n at 94" but actual code has round1n at 82 and fmt1 at 94.  |
| `engine-cost-per-dose` | ✅complete | none | Validation target's runtime example says "round1n → 5.00" but the function uses round2 not round1n; the resulting number |
| `engine-cost-per-mg` | ✅complete | none | calculateCostPerMg at costAnalysis.ts:57 returns round3(materialCost/totalThcMg); 60/525=0.114285 → 0.114 matches exampl |
| `engine-method-cost-comparison` | ✅complete | none | compareMethodCosts at line 119 implements the full pipeline (theoreticalMax→decarbed→infused→servings→cost/dose+cost/mg) |
| `engine-thc-theoretical-max` | ✅complete | none | Validation target's runtime example claims 7g×15%THCA=920.5 mg but the math actually yields 7×0.15×0.877×1000=920.85, wh |
| `engine-thc-decarb-range` | ✅complete | none | calculateRange at decarb.ts:77 enforces low<=expected<=high ordering (lines 96-100) and returns an EfficiencyRange; DESI |
| `engine-cbd-theoretical-max` | ✅complete | none | calculateTheoreticalMaxCbd at cbda.ts:26 uses the same 0.877 factor via CBDA_TO_CBD_FACTOR (cbda.ts:10-13). 5g×10%CBDA = |
| `engine-cbd-decarbed-amount` | ✅complete | none | calculateDecarbedCbd at cbda.ts:57 returns round1(theoreticalMax*efficiency); 438.5×0.9=394.65→394.7 matches the validat |
| `engine-mg-per-ml` | ✅complete | none | calculateMgPerMl at infusion.ts:44 returns round1(infusedThc/volumeMl); 787.6/240=3.2816→3.3 matches. All four claimed c |
| `engine-simplified-estimate` | ✅complete | none | Validation target's example says "7g × 0.20 thca × 7.45 → 10.4 g quick-estimate display" — units and scaling are off (th |
| `engine-dose-display-label` | ✅complete | none | displayDoseLabel at dosing.ts:77 maps 7 canonical tokens to Title-Case (line 85 confirms 'moderate'→'Moderate') with a p |
| `engine-concentrate-theoretical-max` | ✅complete | none | calculateConcentrateTheoreticalMax at concentrate.ts:124 uses the same 0.877 formula as the flower path. CONCENTRATE_TYP |
| `engine-concentrate-decarbed-thc` | ✅complete | none | calculateConcentrateDecarbedThc is implemented at line 155 and is called from AdvancedToolsTab.tsx:409 (line 13/14 impor |
| `engine-concentrate-decarb-range` | ✅complete | none | calculateConcentrateRange is implemented at line 178 and is wired into DecarbTab.tsx:17 (import) with a real call at lin |
| `engine-bag-material-volume` | ✅complete | none | estimateMaterialVolume at line 23 multiplies grams * grindCm3PerGram and rounds to 1 decimal. BagCalculator.tsx:9 import |
| `engine-bag-fill-depth` | ✅complete | none | calculateFillDepth at line 44 divides materialVolumeCm3 by (bagWidthCm * bagLengthCm) and rounds to 3 decimals. BagCalcu |
| `engine-bag-headspace` | ✅complete | none | calculateHeadspace at line 90 returns ((bag - material) / bag) × 100, rounded to 1 decimal. BagCalculator.tsx:11 imports |
| `engine-headspace-status-zones` | ✅complete | none | getHeadspaceStatus at line 119 implements the four zones: <5% or >40% → 'critical' (line 120), 10-25% → 'optimal' (line  |
| `engine-double-bag-recommendation` | ✅complete | none | recommendDoubleBag at line 138 returns true when hasStems (line 143) or zip+tempC>=95 (line 144), else false (line 145). |
| `engine-best-bag-selection` | ✅complete | none | selectBestBag at line 161 filters overflows, picks the smallest optimal (10-25%) bag as 'best' and the next as 'alternat |
| `engine-strain-blend-calculator` | ✅complete | none | calculateBlend at line 58 implements the two-strain linear system and returns isAchievable=false when target is outside  |
| `engine-doneness-simulation` | ✅complete | none | simulateDoneness at line 77 implements Forward-Euler integration of THCA→THC→CBN with k1 (Ea₁=87.06 kJ/mol, A₁=8.4e10/mi |
| `engine-doneness-time-label` | ✅complete | none | timeLabel at line 191 formats minutes: <60 → `${m}m`, >=60 with m=0 → `${h}h`, >=60 with m>0 → `${h}h ${m}m`. KnowledgeT |
| `engine-lab-text-parser` | ✅complete | none | parseLabText at line 102 calls extractValue per cannabinoid, and extractValue checks patterns in order: the mg/g pattern |
| `engine-lab-data-detector` | ✅complete | none | labParser.ts:137 exposes `looksLikeLabData(text): boolean` which returns true only when parseLabText finds at least one  |
| `engine-radar-score-computation` | ✅complete | none | computeRadarScores at radarScores.ts:201 returns all six axes (thcDose, cbdDose, onsetSpeed, duration, bodyLoad, headLoa |
| `engine-radar-chart-geometry` | ✅complete | none | RADAR_AXES at line 261-268 defines exactly 6 axes. radarPoints (line 274) starts angle at `-Math.PI/2` (-90°, top) and p |
| `engine-recipe-scaler` | ✅complete | none | scaleRecipe at recipe.ts:334 throws on non-finite or non-positive factor (line 335-340), scales decarb.weight / infusion |
| `engine-smart-recipe-suggest` | ✅complete | none | MG_WEIGHT=70, FAT_MATCH_WEIGHT=30, FAT_PARTIAL_WEIGHT=15, FAT_ANY_WEIGHT=15 (line 127-130). scoreRecipe (line 148) gates |
| `engine-terpene-boiling-points` | ✅complete | none | TERPENES array at terpenes.ts:29 holds exactly 5 entries with boilingPointC values Myrcene 168, Limonene 176, alpha-Pine |
| `engine-first-timer-decarb-efficiency` | ✅complete | none | FIRST_TIMER_DECARB_EFF = 0.93 at wizardPresets.ts:114. DECARB_METHODS['oven_sealed'].efficiency.expected = 0.93 at model |
| `engine-strain-library` | ✅complete | none | validateStrain (strainLib.ts:24) enforces 80-char name, percentages 0-100, thcaPct+thcPct<=100 (line 55), cbdaPct+cbdPct |
| `engine-avb-residual-ranges` | ✅complete | none | AVB_RESIDUAL_THC_RANGES at decarb.ts:167-171 holds light {5,6.5,8} (mid 6.5), medium {3,4,5} (mid 4), dark {1,2,3} (mid  |
| `engine-cbd-decarb-range` | ⚠partial | low | calculateCbdRange (cbda.ts:80) is exported and tested but has zero UI consumers — DecarbTab.tsx:618-620 inlines the thre |
| `engine-zod-validation-schemas` | ✅complete | none | decarbInputSchema (schemas.ts:36-131) with getDecarbWarnings (line 139), infusionInputSchema (line 162) with getInfusion |
| `engine-infusion-input-schema` | ✅complete | none | infusionInputSchema at schemas.ts:162-190: decarbedThc refine >= 0 (line 169) catches negatives, volume refine > 0 (line |
| `engine-fat-compare-input-schema` | ✅complete | none | fatCompareInputSchema is exported at line 214 with friendly error messages; AdvancedToolsTab.tsx imports it (line 29) an |
| `engine-infusion-warnings` | ✅complete | none | getInfusionWarnings at schemas.ts:197 implements the 'volume < decarbedThc/20' rule with the 'Not much fat volume here'  |
| `engine-zod-issues-to-field-errors` | ✅complete | none | zodIssuesToFieldErrors at line 413 walks the issues and writes a flat {firstPathKey: message} map; consumed by InfusionT |
| `engine-decarb-input-warning` | ⚠partial | medium | No UI consumer: the high-cannabinoid advisory never surfaces to the user. Both schemas.ts:139 and validation.ts:93 are u |
| `engine-decarb-method-presets` | ✅complete | none | DECARB_METHODS at models.ts:232 has exactly 6 entries: sv_dry, sv_combined, sv_fast, sv_lowtemp (73–95°C) + oven_sealed, |
| `engine-infusion-fat-presets` | ✅complete | none | INFUSION_FATS at models.ts:311 has exactly 4 entries: ghee (0.85, ×7.45), coconut (0.82, ×7.19), mct (0.92, ×8.07), cust |
| `engine-edible-format-presets` | ✅complete | none | EDIBLE_FORMATS at models.ts:168 has exactly 6 entries (brownie_9x13, brownie_8x8, gummy_80, gummy_160, capsule_00, custo |
| `engine-wizard-card-data` | ✅complete | none | WIZARD_RECIPES, DECARB_METHOD_CARDS, and FAT_CARDS exist at wizardPresets.ts:281/293/311 with curated humanNote prose fo |
| `engine-build-export-report` | ✅complete | none | buildExportReport at line 728 builds the text+JSON ExportData by composing decarb/infusion/dose/methods/fats/concentrate |
| `engine-build-tab-copy-text` | ✅complete | none | buildTabCopyText at line 803 has the exact switch structure described: 'decarb' \| 'infusion' \| 'dose' \| 'methods' \|  |
| `engine-avb-theoretical-max` | ↔drift_confirmed | low | calculateAvbTheoreticalMaxFromColor (decarb.ts:220) has no UI consumer — convenience helper is dead code. Main path thro |
| `engine-thc-degradation-kinetics` | ⚠partial | medium | No UI consumer. Engine module is import-clean and ready for a future Storage tab, but the 'as a long-term storer' user c |
| `engine-bag-volume` | ✅complete | low | calculateBagVolume is orphan in runtime code; only bagVolume.test.ts exercises it. BagCalculator reads the preset's pre- |
| `engine-lab-text-strict-parser` | ✅complete | low | parseLabTextStrict is orphan in production code — no UI or batch-mode consumer currently calls it. LabPasteField uses pa |
| `engine-recipe-save-load` | ✅complete | low | saveRecipe / loadRecipe are orphan in current code — no tab or component calls them. User cannot yet save/load named rec |
| `engine-recipe-format-name-lookup` | ✅complete | low | formatName is orphan in production code — only recipeScoring.test.ts exercises it. SmartSuggestPanel renders recipe.name |
| `engine-reverse-full-workflow` | ✅complete | none | reverseFullWorkflow is implemented at reverse.ts:102 — back-solves through dose → infusion → decarb, returns 2-decimal-p |
| `engine-reverse-decarb` | ✅complete | low | reverseDecarb is orphan in production code — DoseTab uses reverseFullWorkflow end-to-end instead. No current UI surface  |
| `engine-wizard-options-aliases` | ✅complete | none | wizardOptions.ts:25-28 re-exports DECARB_METHOD_CARDS as METHOD_OPTIONS, FAT_CARDS as FAT_OPTIONS, WIZARD_RECIPES as FOR |
| `engine-wizard-recipe-lookups` | ✅complete | low | All four lookup functions are orphan in production code — only wizardPresets.test.ts exercises them. FirstTimerGuide use |
| `engine-grind-level-presets` | ✅complete | none | GRIND_LEVELS is exported at models.ts:352 with the three entries (coarse 6.0, medium 3.5, fine 2.2 cm3PerGram). BagCalcu |
| `engine-bag-presets` | ✅complete | none | BAG_PRESETS is exported at models.ts:365 with 5 entries (quart 61.4 cm3, gallon 195.3, 2gallon 435.4, small_vac 57.9, la |
| `engine-strain-model` | ✅complete | none | Strain interface is defined at models.ts:205 with id/name/type (indica\|sativa\|hybrid)/thcaPct/thcPct/cbdaPct/cbdPct/no |
| `engine-evaluate-startup-routing` | ✅complete | none | evaluateStartupRouting is implemented at startupRouting.ts:126 — returns {confidence, destinationTab, mode, reason, reco |
| `engine-destination-for-startup-intent` | ✅complete | none | destinationForStartupIntent at startupRouting.ts:205 wraps intentDestination(), which maps make_batch→'quickbatch', hist |
| `engine-1000-plus-vitest-tests` | ✅complete | none | DESIGN.md claims '1,148 tests across 60 test files' as of 2026-07-25. Live npx vitest run shows 1176 tests across 61 tes |
| `engine-constant-audit-discipline` | ✅complete | none | research/academic-references.md documents a 55-constant audit with explicit citation rows (#13-#60), and lists which row |
| `engine-pure-typescript-no-ui-deps` | ✅complete | none | `rg "from 'react'" src/renderer/src/engine` and analogous greps for 'electron', '@radix-ui', 'lucide', 'sonner' return z |
| `engine-display-mapper-engine-delegation-pattern` | ✅complete | none | Engine exports formatting/validation mappers (zodIssuesToFieldErrors in schemas.ts:413) and tab code calls them rather t |

### main-electron (8/9 complete)

| id | verdict | sev | gap/note |
|---|---|---|---|
| `main-electron-frameless-window-with-custom-chrome` | ✅complete | none | BrowserWindow constructor at main.ts:55-56 sets `frame:false, titleBarStyle:'hidden'` (semantically equivalent to docs'  |
| `main-electron-export-copy-preset-ipc` | ✅complete | none | All four IPC handlers (export-report, copy-to-clipboard, save-preset, load-preset-dialog) are present with the spec'd be |
| `main-electron-journal-disk-persistence` | ✅complete | none | All three journal handlers present with SAFE_ID_RE path-traversal guard (lines 270, 342), readdir+sort newest-first (300 |
| `main-electron-strain-library-persistence` | ✅complete | none | save-strains writes strains.json to userData/strains/, load-strains reads it back and returns [] for missing or non-arra |
| `main-electron-open-external-link` | ✅complete | none | open-external handler at main.ts:403-419 validates URL parseability (407-409) and protocol allowlist (410-412) before de |
| `main-electron-platform-info` | ⚠partial | low | No renderer code reads App.platform to drive platform-specific UI affordances. Bridge value exists but the user-facing c |
| `main-electron-windows-nsis-portable-zip` | ✅complete | none | electron-builder.ts:50 sets win.target = ['nsis', 'zip', 'portable']. nsis config (53-62) matches the spec'd flags. port |
| `main-electron-macos-dmg` | ✅complete | none | electron-builder.ts:33-38 configures mac.target = ['zip', 'dmg', 'dir'] with artifactName + icon + category. DESIGN.md:4 |
| `main-electron-linux-appimage-deb-rpm` | ✅complete | none | electron-builder.ts:40-45 configures linux.target = ['AppImage', 'deb', 'pacman', 'freebsd', 'rpm'] — AppImage, deb, and |

### renderer-shell (11/13 complete)

| id | verdict | sev | gap/note |
|---|---|---|---|
| `renderer-shell-main-screen-chrome` | ✅complete | none | TitleBar rendered at line 246, brand header (BrandGlyph + 'CCC' wordmark + Choose Start + First-Timer Guide) at 253-281, |
| `renderer-shell-first-paint-overlay` | ✅complete | none | isLoading state at line 112, setTimeout 800ms followed by 350ms fade-out timer at 121-127, overlay render with BrandGlyp |
| `renderer-shell-theme-application` | ✅complete | none | theme = useAppStore(s => s.theme) at line 98, useEffect at 129-131 calls document.documentElement.classList.toggle('dark |
| `renderer-shell-workflow-stage-accent` | ✅complete | none | useEffect at 139-147 sets document.body.dataset.workflowStage to 'decarb'/'infusion'/'dose'/'landing' based on activeTab |
| `renderer-shell-electron-html-shell` | ✅complete | none | index.html:2 has <html lang='en' class='dark'>; lines 12-15 declare CSP meta with img-src 'self' data: (allowing the SVG |
| `renderer-shell-react-app-bootstrap` | ✅complete | none | index.tsx imports React 18 createRoot (line 1), Space Grotesk font (line 4), platform bootstrap side-effect (line 12), A |
| `renderer-shell-single-route-routing` | ✅complete | none | routes.tsx:7-9 declares a single <Route element={<MainScreen />} path='/' /> wrapped by Router (from lib/electron-router |
| `renderer-shell-startup-chooser-heuristic-manual-escape` | ✅complete | none | evaluateStartupRouting returns mode='route' for high-confidence or mode='chooser' for medium/low (startupRouting.ts:142- |
| `renderer-shell-first-time-wizard-boot` | ✅complete | none | main.tsx:166-179 implements the wizard boot gate: when firstRunDismissed === false AND wizardDismissed !== true, it sets |
| `renderer-shell-pwa-install-surface` | ↩reclassified | none | The full static icon set is on disk: favicon.ico, favicon.svg, apple-touch-icon-180x180.png, pwa-64x64.png, pwa-192x192. |
| `renderer-shell-cn-classname-helper` | ✅complete | none | utils.ts:1-6 exports a 6-line cn() that composes clsx + twMerge exactly as described. The helper is imported by 32 rende |
| `renderer-shell-alert-ui-primitive` | ✅complete | low | No consumer — the primitive is installed but never imported anywhere outside its own file (zero matches for `ui/alert` a |
| `renderer-shell-vertical-stacked-layout-drift` | ↔drift_confirmed | high | validation_report.md misrepresents the layout as vertically stacked with all tabs visible. Reality: 3D TabCarousel (5 wo |

### store-state (23/23 complete)

| id | verdict | sev | gap/note |
|---|---|---|---|
| `store-state-persisted-units-slice` | ✅complete | none | UnitPreferences interface (lines 29-34) defines tempUnit/weightUnit/volumeUnit/bagUnit — exactly the four unit families  |
| `store-state-persisted-decarb-slice` | ✅complete | none | DecarbState interface (lines 36-98) covers weight, weightUnit, thcaPct/thcPct/cbdaPct/cbdPct, presetId, tempOverride, ba |
| `store-state-persisted-infusion-slice` | ✅complete | none | InfusionState interface (lines 100-111) defines decarbedThc, volume, volumeUnit, fatId, customEfficiency — exact match t |
| `store-state-persisted-dose-slice` | ✅complete | none | DoseState interface (lines 113-121) defines totalThc, servings, formatId, reverseMode, desiredMgPerServing — exact match |
| `store-state-persisted-advanced-tools-slice` | ✅complete | none | AdvancedToolsState (lines 152-157) groups subTab + concentrate (lines 123-129) + blending (lines 136-140) + cost (lines  |
| `store-state-persisted-startup-routing-slice` | ✅complete | none | StartupRoutingState (lines 159-166) covers launchCount, chooserShownCount, lastChooserIntent, lastSuccessfulIntent, last |
| `store-state-persisted-theme-slice` | ✅complete | none | Theme type ('dark' \| 'light') at line 27, state declared at 491-493, defaults to 'dark' at 649 with setTheme + toggleTh |
| `store-state-persisted-label-slice` | ✅complete | none | LabelState (lines 168-177) defines productName, ingredients, storage, batchNumber, three facility allergen booleans (nut |
| `store-state-persisted-inventory-slice` | ✅complete | none | InventoryState (lines 294-297) has items (InventoryItem[]) and lowStockThreshold; InventoryItem.kind optional literal 'f |
| `store-state-persisted-first-run-dismissed` | ✅complete | none | firstRunDismissed is in partialize (1717), written by dismissOnboarding (835-843) in lockstep with wizard.dismissed, and |
| `store-state-persist-versioned-migrations` | ✅complete | none | Code implements the full chained migration v0→v1→v2→v3→v4→v7 in one migrate function. The DESIGN.md shorthand 'v1→v7' is |
| `store-state-persist-key-rename` | ✅complete | low | No automated test for the old-key fallback + cleanup in setItem; relies on the live runtime flow target. |
| `store-state-per-field-unit-tracking` | ✅complete | none | The synthesizer's drift note is confirmed: the audit-briefs tag the migration guards as 'roadmap_planned' but the code i |
| `store-state-cross-tab-carry-forward` | ✅complete | low | Story's evidence cite says 'setLastDecarbedThc' but the actual field is 'setLastDecarbExpected'. Naming is cosmetic, the |
| `store-state-load-preset-snapshot` | ✅complete | none | loadFromPreset is a full bulk-replace with per-field unit coercion to safe defaults on miss/invalid. Each per-field unit |
| `store-state-active-tab-not-persisted` | ✅complete | low | activeTab is initialized to 'decarb' (646), is settable via setActiveTab (647), and is deliberately excluded from partia |
| `store-state-strain-library-runtime-only` | ✅complete | low | addStrain/updateStrain/deleteStrain action signatures (541-543) are unused by StrainManager.tsx (which uses setStrains), |
| `store-state-journal-disk-persistence` | ✅complete | low | journalEntries is an in-memory cache populated on mount via window.App.loadJournalEntries (JournalTab.tsx:198) and saved |
| `store-state-wizard-selections-persisted-runtime-reset` | ✅complete | none | The wizard partialize (1721-1724) explicitly persists only {dismissed, selections}; active and stepIndex are runtime-onl |
| `store-state-wizard-fat-volume-field` | ✅complete | low | The appStore-level wizard test (appStore.wizard.test.ts:129-141) tests grams/thcaPct/servings but not fatVolume specific |
| `store-state-timer-runtime-only` | ✅complete | low | TimerState is fully defined (388-393) with start/stop/reset actions (787-803). The partialize (1702-1725) does not inclu |
| `store-state-onboarding-dismiss-action` | ✅complete | none | dismissOnboarding (appStore.ts:835-843) sets firstRunDismissed=true, wizard.active=false, wizard.dismissed=true. Persist |
| `store-state-legacy-dismiss-shims` | ✅complete | none | Both dismissFirstRun (848-856) and dismissWizard (924-932) exist with bodies byte-identical to dismissOnboarding. Both a |

### tabs-ui (54/62 complete)

| id | verdict | sev | gap/note |
|---|---|---|---|
| `tabs-ui-dashboard-overview` | ✅complete | none | DashboardTab renders a primary stats grid (467-518) with Total Batches / This Month / Avg Potency / Total THC / Most Use |
| `tabs-ui-dashboard-low-stock-alert` | ✅complete | none | inventoryTotals.lowStock (356) computes onHand < threshold (default 3.5g, user-configurable via inventory.lowStockThresh |
| `tabs-ui-dashboard-inventory-management` | ✅complete | none | InventorySection is mounted on the Dashboard (DashboardTab.tsx:525-527) and is the write-side UI for the inventory slice |
| `tabs-ui-dashboard-charts` | ✅complete | none | All three chart components are real: BarChartSVG (50-93, batches/month), PieChartSVG (95-203, methods used), and Sparkli |
| `tabs-ui-decarb-calculator` | ✅complete | none | 3-way material mode toggle (flower / concentrate / avb) at 880-938 wires to decarb.materialMode. The debounced useEffect |
| `tabs-ui-decarb-strain-and-lab-input` | ✅complete | none | Both inputs are wired end-to-end. handleSelectStrain (682-693) writes thcaPct/thcPct/cbdaPct/cbdPct/strainId to the stor |
| `tabs-ui-decarb-method-and-overrides` | ✅complete | none | Method preset picker (1289-1316) writes presetId; handlePresetChange (704-713) clears all overrides on preset switch. Th |
| `tabs-ui-decarb-avb-mode` | ✅complete | none | AVB_RESIDUAL_THC_RANGES is exported from the engine (decarb.ts:167-170) with light/medium/dark entries. The Decarb tab i |
| `tabs-ui-decarb-advanced-cbd` | ✅complete | none | The Advanced Settings toggle (1318-1335) reveals CBDA% and Existing CBD% inputs (1227-1281), gated on showAdvanced && !i |
| `tabs-ui-decarb-inventory-warnings` | ✅complete | none | Inventory warning effect (286-360) covers the 3-case gate: (a) no weight typed → no warning; (b) weight entered but no m |
| `tabs-ui-decarb-reset` | ✅complete | none | handleReset (line 739) calls the real resetDecarb() store action and clears local UI state (results, errors, warnings, s |
| `tabs-ui-infusion-calculator` | ✅complete | none | InfusionTab wires calculateInfusedThc + calculateMgPerMl to a debounced effect (203-291), inputs (decarbedThc, fat prese |
| `tabs-ui-infusion-custom-efficiency` | ✅complete | none | extractionEff memo (185-191) reads infusion.customEfficiency when isCustom (preset.id === 'custom', line 157). The input |
| `tabs-ui-infusion-volume-unit-toggle` | ✅complete | none | handleVolumeUnitToggle (301-307) updates only units.volumeUnit without mutating the stored infusion.volume. The input di |
| `tabs-ui-infusion-show-formula` | ✅complete | none | showFormula local state (160) toggles via button onClick at 645. When true, the formula block (656-690) renders inside t |
| `tabs-ui-infusion-reset` | ✅complete | none | handleReset (309-315) calls resetInfusion() from the store and clears results, field errors, inline warnings, and showFo |
| `tabs-ui-dose-forward-calculator` | ✅complete | none | DoseTab auto-fills totalThc from lastInfusedThc (286-295) with the 'Auto-filled from Infusion' badge at 565-569. The deb |
| `tabs-ui-dose-reverse-calculator` | ✅complete | none | Reverse mode toggle (519-538) sets dose.reverseMode. When isReverse, the debounced effect (425-486) calls reverseFullWor |
| `tabs-ui-dose-classification-scale` | ↔drift_confirmed | low | Docs (orchestrator_brief.md and ui-ux-touchpoint docs) still say 4-tier 'micro/standard/strong/heavy'. Code is the sourc |
| `tabs-ui-dose-edible-format` | ✅complete | none | EDIBLE_FORMATS import (7-11) feeds the Edible Format select (669-691). The onChange (671-678) looks up the format and ca |
| `tabs-ui-dose-scale-batch` | ✅complete | none | handleScale (324-353) builds a Recipe from the current store snapshot and calls scaleRecipe (recipe.ts:334), then writes |
| `tabs-ui-dose-label-generator` | ✅complete | none | LabelGenerator is imported (22) and mounted inline in the dose grid (923-932) when !isReverse && results, receiving mgPe |
| `tabs-ui-dose-show-formula` | ✅complete | none | Button at line 891 toggles `showFormula`; expanded panel reveals the dose math formula ('mg per serving = total infused  |
| `tabs-ui-dose-reset` | ✅complete | none | handleReset at 492 calls resetDose(), clears recordedResultRef, sets results to null, clears fieldErrors, and resets sho |
| `tabs-ui-quickbatch-5-step-wizard` | ✅complete | none | 5 distinct STEPS render blocks (indices 0-4) with destination-aware Next labels (nextStepIndex is +2 in AVB mode, +1 oth |
| `tabs-ui-quickbatch-load-last-batch` | ✅complete | none | lastEntry is computed from sorted journalEntries; handleLoadFromLastBatch restores material weight, percentages, method, |
| `tabs-ui-quickbatch-label-and-save` | ✅complete | none | handleSaveBatch persists via window.App.saveJournalEntry first, only adds to local store on success (avoids phantom-entr |
| `tabs-ui-quickbatch-reset` | ✅complete | none | handleReset calls all three reset actions (decarb/infusion/dose), sets step back to 0, and clears scale UI state. Button |
| `tabs-ui-journal-load-entries` | ✅complete | none | On mount, useEffect calls window.App.loadJournalEntries(), maps each entry to the typed shape, calls setJournalEntries.  |
| `tabs-ui-journal-new-entry-form` | ✅complete | none | The form renders every field the story enumerates: date (436), strainName (446), materialWeight (459), thcaPct (473), th |
| `tabs-ui-journal-log-from-calculator` | ⚠partial | low | Button is on Journal tab (not Dose tab as story claims); journal entry saves `totalInfusedThc` (not `totalThc`) and `vol |
| `tabs-ui-journal-save-entry` | ✅complete | none | handleSave gates on window.App.saveJournalEntry availability, then on non-empty strainName (returns early with toast if  |
| `tabs-ui-journal-delete-entry` | ✅complete | none | First click on a row's trash button sets pendingDeleteId (line 778), which swaps the row into a Cancel/Confirm in-card g |
| `tabs-ui-journal-search-and-filter` | ✅complete | none | Text search matches against strainName/methodName/fatName/classification (case-insensitive substring). Date filter is a  |
| `tabs-ui-journal-timer` | ✅complete | none | JournalTab imports TimerWidget (line 17) and mounts it on the page (line 414). TimerWidget renders decarb-method preset  |
| `tabs-ui-methods-comparison` | ✅complete | none | MethodsTab renders all 6 DECARB_METHODS (sv_dry, sv_combined, sv_fast, sv_lowtemp, oven_sealed, oven_open) in a 2-col gr |
| `tabs-ui-methods-use-this` | ✅complete | none | handleUseThis writes the chosen presetId to the decarb slice and switches to the 'decarb' tab (lines 259-262). The 'Use  |
| `tabs-ui-methods-avb-callout` | ✅complete | none | isAvbMode toggle is set from decarb.materialMode === 'avb' (line 272). When true, the Use This button is replaced by an  |
| `tabs-ui-methods-reset` | ✅complete | none | handleReset calls resetDecarb() from the store and clears local results/errors/warnings. The header Reset button at line |
| `tabs-ui-advanced-fat-comparison` | ⚠partial | medium | No volume input or volume-unit toggle UI is rendered inside the Fats sub-tab. The user can only see volume-based mg/mL o |
| `tabs-ui-advanced-concentrate-calculator` | ✅complete | none | ConcentrateSection handleUseThis (lines 454-481) sets materialMode='concentrate', concentrateTypeId, weight, weightUnit  |
| `tabs-ui-advanced-strain-blending` | ✅complete | none | BlendingSection renders per-strain name+potency rows with addStrain (703), removeStrain guarded by .length <= 2 (716-717 |
| `tabs-ui-advanced-cost-analysis` | ✅complete | none | CostSection drives an engine compareMethodCosts across all 6 methods plus a calculateCostPerDose for the instant $/servi |
| `tabs-ui-advanced-sub-tab-nav` | ✅complete | none | SUB_TABS array lists 4 sub-tabs (Fats/Concentrates/Blending/Cost) with icons. The 4-up tab strip (1268-1285) drives setA |
| `tabs-ui-advanced-reset` | ✅complete | none | The header Reset button (1258-1265) calls resetAdvancedTools, which is defined in appStore.ts (line 515, implementation  |
| `tabs-ui-knowledge-explainer-sections` | ✅complete | none | KnowledgeTab renders 14+ SectionCard blocks covering Conversion Pathway (556), How Decarboxylation Works (584), The 0.87 |
| `tabs-ui-knowledge-doneness-curve` | ✅complete | none | DonenessCurve function defined at line 91 with useState for tempDisplay/timeMin; useMemo at line 147 recomputes simulate |
| `tabs-ui-knowledge-apply-curve-to-decarb` | ✅complete | none | handleApplyToDecarb at line 133 calls setDecarb with tempOverride+tempOverrideUnit+timeOverride and setActiveTab('decarb |
| `tabs-ui-knowledge-citations` | ✅complete | none | Cite component (line 485) calls window.App.openExternal(`https://doi.org/${doi}`) on click and renders a real <a target= |
| `tabs-ui-knowledge-terpene-table` | ✅complete | none | Terpene table at line 881 renders a 4-column table (Terpene, Normal Boiling Point, Notes, Source) from the TERPENES arra |
| `tabs-ui-first-timer-guide-wizard` | ✅complete | low | Stale doc-comment at FirstTimerGuide.tsx:4 says 'Six steps' but STEPS array has 8 entries. Not a functional gap; only a  |
| `tabs-ui-wizard-step-jump-and-nav` | ✅complete | none | canGoNext (line 712) is per-step gated (material needs positive grams+thcaPct; decarb/fats/formats need at least one sel |
| `tabs-ui-wizard-visual-pickers` | ✅complete | none | GRIND_OPTIONS (1276), BAG_OPTIONS (1306), PACK_OPTIONS (1341) all carry image+imageWebp+captions. StepPrep (line 1666) r |
| `tabs-ui-wizard-use-decarb-shortcut` | ✅complete | none | handleUseDecarbShortcut (line 772) reads decarbDefaults.weight and decarbDefaults.thcaPct, validates numerics, and write |
| `tabs-ui-wizard-review-matrix` | ✅complete | none | matrix useMemo (line 499) builds the full method×fat×format cartesian product with live-computed decarbed/infused/perSer |
| `tabs-ui-wizard-save-or-open` | ✅complete | none | handleSaveToJournal (line 565) takes only matrix[0] (line 567) — the top recommendation, not all rows (fixes the ccc-val |
| `tabs-ui-realtime-recalc-debounce` | ↩reclassified | none | Synthesizer flagged this as docs_only with 'no in-scope file:line'. Grep shows 5 tab files use `setTimeout(..., 300)` fo |
| `tabs-ui-cross-tab-unit-toggles` | ↔drift_confirmed | high | DecarbTab Advanced Settings has no bag width/length input (claim from orchestrator_brief.md:42 is false). FirstTimerGuid |
| `tabs-ui-result-panel-aria-live` | ✅complete | none | The synthesizer's drift claim ('unverified at the tab level') is wrong. 7 aria-live regions exist across src/renderer/sr |
| `tabs-ui-reduced-motion-respect` | ↔drift_confirmed | medium | src/renderer/src/tabs/DoseTab.tsx, InfusionTab.tsx, and DecarbTab.tsx do not import or use useReducedMotion; the .result |
| `tabs-ui-vertical-stacked-layout-drift` | ↔drift_confirmed | medium | validation_report.md describes a monolithic prototype where all 7 sections are simultaneously rendered; the actual imple |
| `tabs-ui-6-tab-scientific-calculator-drift` | ↔drift_confirmed | low | cannabis_chemistry_calculator_research.md still describes a 6-tab calculator; the actual shipped product is 9 calculator |

