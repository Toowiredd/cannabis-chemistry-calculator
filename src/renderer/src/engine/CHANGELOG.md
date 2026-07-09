# Engine Changelog

Changes specific to the chemistry engine (`src/renderer/src/engine/`). For project-wide changes, see the top-level `CHANGELOG.md`.

## Unreleased

### Changed — 2026-07-09 — Arrhenius kinetics recompute (Jaidee 2022)

- `doneness-simulation.ts`
  - `Ea₂` 110 kJ/mol → **51.70 kJ/mol** (Jaidee 2022 Table 3, pH-2 solution pseudo-first-order Δ9-THC degradation, DOI 10.1089/can.2021.0004)
  - `A₂` 2.0×10¹² s⁻¹ → **6.40×10⁶ day⁻¹**, converted to per-minute via `/1440`
  - New exported helper `k2ThcToCbnPerMin(tempC): number` for test/audit access (returns k₂ in per-minute units)
  - Header doc-block rewritten: full citation block listing `#2 Wang 2016` and `#7 Jaidee 2022`, with explicit math-form-choice rationale and the dried-resin vs. pH-2-solution note
  - File-level drift warning removed (audit row 14 closed)

- `doneness-simulation.test.ts`
  - +3 Vitest cases:
    - `k₂(25 °C)` reproduces the Jaidee-published value within 1 % relative
    - halflife at 25 °C is between 1 day and 10 years (real-world sanity band)
    - Q10 ≈ 2 ± 0.4 across 25 °C → 95 °C (Arrhenius temperature dependence shape)

### 2026-07-09 — Citation audit pass (chem-engine)

- Every numeric / qualitative constant in 18 source files audited against `research/academic-references.md`
- 6 inline citations added (where the engine used a value that came from a peer-reviewed source but never cited it)
- 22 `// TODO(citation): <reason>` flags added with rationale in source
- 2 secondary citations flagged `⚠ unverified DOI` (Trofin 2012, Lindholst 2010 — only seen via Jaidee 2022 reference list)
- 1 drift flag (`doneness-simulation.ts Ea₂`) — **resolved in this same cycle**, see above
- 1 drift flag retained (`degradation.ts` rate constants below measured temperature window, comments corrected)
- Audit table appended to `research/academic-references.md`
- All `__tests__/` suites updated to reflect the new audit annotations

### Test counts

- 166 tests across 6 files → **601 tests across 23 files** (post-recompute: 23 files, 601 tests, typecheck clean)
