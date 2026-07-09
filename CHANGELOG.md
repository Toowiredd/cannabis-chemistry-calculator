# Changelog

All notable changes to the Cannabis Chemistry Calculator are recorded here. Dates are in `Australia/Sydney` (UTC+10). Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) starting from `1.0.0`.

## [Unreleased]

### Added — 2026-07-09

- **Engine constant citations audit** — Every numeric / qualitative constant in `src/renderer/src/engine/*.ts` walked against `research/academic-references.md`. Six citations added inline (`Filer 2022`, `Citti 2018`, `Jaidee 2022 Trofin 2012 Lindholst 2010` secondary cites), twenty-two `// TODO(citation)` flags added with rationale in source, one drift flag (`doneness-simulation.ts Ea₂`) resolved via recompute from Jaidee 2022 Table 3. Audit table appended to `research/academic-references.md`.
- **Arrhenius constants recompute** — `doneness-simulation.ts` `Ea₂` and `A₂` recomputed from **Jaidee 2022 Table 3** (DOI `10.1089/can.2021.0004`, pH-2 solution pseudo-first-order Δ9-THC degradation). New constants: `Ea₂ = 51.70 kJ/mol`, `A₂ = 6.40×10⁶ day⁻¹`. Implied halflife at 25 °C is now ≈122 days (matches industry-reported room-temp THC stability), vs. the prior sub-hour value implied by the engineered `Ea₂ = 110 kJ/mol`. New exported helper `k2ThcToCbnPerMin(tempC)` enables test/audit access to the rate constant.
- **Doneness sanity tests** — Three new Vitest cases in `src/renderer/src/engine/__tests__/doneness-simulation.test.ts`: `k₂(25 °C)` reproduces Jaidee within 1 % relative, halflife is in the real-world 1-day-to-10-years band, and the rate roughly doubles per 10 °C between 25 °C and 95 °C (Q10 ≈ 2 ± 0.4).
- **Mavis team scaffolding** — `.harness/` (project-level team definitions) and `.mavis/` (orchestrator plan templates) added. Seven reins matching the project's actual code paths (`chem-engine`, `ui-tabs`, `design-system`, `rich-features`, `state-routing`, `electron-shell`, `qa-e2e`), each with full system prompt + scoped ownership boundaries + verification checkpoints. Orchestrator conductor rules documented in `.harness/docs/conductor.md` so future sessions re-derive the routing table without re-reading the codebase. Plan templates available under `.mavis/plans/` (`template.yaml`, `example-add-decarb-preset.yaml`, `example-run-e2e-audit.yaml`, `decision.example.json`, `README.md`).

### Changed — 2026-07-09

- **`doneness-simulation.ts` doc-block** — Replaced the "drift flag" header with a full citation block citing `#7 Jaidee 2022` for k₂ and `#2 Wang 2016` for k₁. Unit notes spell out the day⁻¹ → /min conversion factor.
- **README test count** — `166 tests` → `601 tests` (engine layer now covers 23 test files, up from 6). Test counts in the project-structure tree updated.
- **DESIGN.md TOC** — New section "5. Engine Citations & Audit" added between "Chemistry Model Rationale" and "Preset Design Rationale"; content documents the citation contract, the Jaidee 2022 recompute, and the math-form-choice rationale for choosing pH-2-solution pseudo-first-order over dried-resin pseudo-zero-order.

### Housekeeping — 2026-07-09

- Workspace debris cleaned: `e.textContent.trim()))` (0-byte botched file), `.playwright-mcp/` (cache + auto-session console logs + page traces), `.pytest_cache/`. Chem-engine session-detritus at project root (`lint_engine_*.txt`, `lint_full_*.txt`, `typecheck_output.txt`, `vitest_engine_output.txt`) trashed.
- Engine directory now carries its own `CHANGELOG.md` for finer-grained history (this file is the project-level changelog for cross-cutting changes).

### Deferred

- `Ea₁/A₁` (THCA→THC Arrhenius constants in `doneness-simulation.ts`) still carry the engineering overestimate on top of Wang 2016 (`#2`). A separate cleanup pass is planned.
- `degradation.ts` rate constants at 4 °C / 25 °C / 40 °C remain extrapolations below Jaidee 2022's measured 50–80 °C window (audit table rows 9–11). Values kept, comments corrected.

---

<!-- Older releases prior to this changelog's creation have been folded into git history. -->
