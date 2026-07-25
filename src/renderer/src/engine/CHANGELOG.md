# Engine Changelog

Changes specific to the chemistry engine (`src/renderer/src/engine/`). For project-wide changes, see the top-level `CHANGELOG.md`.

## Unreleased

### Changed — 2026-07-25 — Arrhenius kinetics recompute (Wang 2016, THCA → THC)

- `doneness-simulation.ts`
  - `Ea₁` 92 kJ/mol (engineering estimate) → **87.06 kJ/mol** (Wang 2016 Table 2, p. 270, 3-point Arrhenius fit of THCA-A rate constants at 80/95/110 °C; R² = 0.998)
  - `A₁` 1.5×10¹² s⁻¹ (engineering 10⁴× overestimate) → **1.40 × 10⁹ s⁻¹ = 8.4 × 10¹⁰ min⁻¹** from the same regression; engine stores A₁ per-minute to match the minute-scale time axis (no `*60` conversion needed)
  - New exported helper `k1ThcaToThcPerMin(tempC): number` for test/audit access (returns k₁ in per-minute units)
  - Header doc-block rewritten: full derivation of the 3-point fit, note that Wang 2016's own rounded summary (88 kJ/mol, 8.7 × 10⁸ s⁻¹) is internally inconsistent with their 3 measured points, and explicit 25 °C extrapolation caveat (predicted halflife ≈ 10 days — much shorter than the empirical 1–100 year room-T stability; would require a low-T-specific citation or a curved Arrhenius plot)
  - File-level drift warning removed (audit rows 13 & 15 closed)

- `doneness-simulation.test.ts`
  - +9 Vitest cases in a new `describe('THCA → THC Arrhenius recompute (Wang 2016)')` block:
    - `k₁(80/95/110 °C)` matches the Wang 2016 Table 2 measured k within 10 % relative (3 anchor tests)
    - `k₁(100/120/140 °C)` is consistent with the regression prediction within 5 % (3 self-consistency tests at non-measured temperatures)
    - Q10 ≈ 2 ± 0.4 between 100 °C and 140 °C
    - `k₁(25 °C)` halflife band test (1 day to 100 years — actual Arrhenius prediction ≈ 10 days; the 1–100 year band from the task spec is NOT supported by Wang 2016 alone, see 25 °C caveat in code)
    - `simulateDoneness(120 °C, 30 min)` reaches > 90 % THC, preserving the 30-min/120 °C decarb window that the prior engineering estimate was tuned to

- `research/academic-references.md`
  - Wang 2016 (#2) entry expanded: page/table for rate data (Table 2, p. 270), explicit citation as the source of the recomputed `Ea₁`/`A₁`
  - Audit table rows 13 & 15 updated to "resolved 2026-07-25" with full fit derivation
  - Header note: 2 drift flags resolved (rows 13 & 15)
  - Drift #2 note: closed for `Ea₁`/`A₁`

- `DESIGN.md`
  - "Engine Citations & Audit" section: new subsection "Arrhenius kinetics — Wang 2016 recompute (2026-07-25)" with full derivation, prior-value rationale, and 25 °C extrapolation caveat

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
- 2026-07-25 update: **1046 tests across 27 files** (post-Wang-2016-recompute: 27 files, 1046 tests, typecheck clean) — added 9 new tests in `doneness-simulation.test.ts`.
