# ccc wizard build — Weeks 1-7 complete (Week 8 pending real-user validation)

## Status: 54 commits ahead of `origin/master` as of 2026-07-27

All committed, pushed, and verified:
- 85 test files / 1559 tests passing (was 76 / 1361 at the start of Week 3)
- `pnpm typecheck` clean
- Working tree clean
- Branch `master` up to date with `origin/master`

## What got built (Weeks 1-7)

| Week | Build order (§7) | What shipped |
|---|---|---|
| 1 | Wizard skeleton + product-type step + Flower Method step | `wizard` slice in `appStore.ts` (state-routing) + `WizardScreen` + `Wizard` + `StepCard` + `OptionTile` + 5 plain-language product-type tiles with tooltips + Flower Method step (6 real decarb methods from the engine) |
| 2 | Branch taxonomy + smart-skip logic | 4 new branches (Concentrate / AVB / Edible / Topical) + `branchSequences.ts` with smart-skip (Fat `null` → skip Volume; Topical → skip Servings) + `Fat` + `Volume` + `Servings` + `Potency` + `Color` + `Carrier` + `ApplicationArea` + `Container` + `Weight` + `Efficiency` step definitions |
| 3 | Stage 2 stepper skeleton + decarb preheat + heatmap | `ExecutionStepper` + 5 execution shells (`PreheatStep` + `HeatmapStep` + `TimerStep` + `TransitionStep` + `CompletionStep`) + `execution` runtime-only slice + `beginExecution` / `completeExecutionStep` / `skipExecutionStep` / `returnToConfig` actions + `data-recalculating` testid hooks |
| 4 | Full decarb execution path (timer + stir + heatmap + transition) | Flower Stage 2 path grew 2 → 4 steps: `preheat-decarb` + `heatmap-decarb` + `timer-decarb` (midpoint-anchored `totalSeconds`, half-point `stirIntervalSeconds`) + `transition-decarb`. Also: `recalculating` flag in the execution slice + `recomputeFromEdit` action (§8.1 re-edit during Stage 2 with "recalculating..." indicator) + `Loader2` Recalculating badge per affected step + `data-recalculating` stepper attribute |
| 5 | Stage 2 infusion + dose + completion + Recipe save | Flower Stage 2 path grew 4 → 8 steps: + `preheat-infusion` (100°C, 30 min) + `timer-infusion` (1800s, stir every 600s) + `transition-infusion` + `completion`. Also: `recipes[]` slice in `appStore.ts` + `addRecipe` / `renameRecipe` / `deleteRecipe` / `setRecipeJournalEntry` actions + persist v8→v9 migration + `NameRecipeStep` component with `deriveDefaultRecipeName` helper + JournalEntry↔Recipe linkage |
| 6 | Resume last + Re-run saved Recipe + Stock recipes + FirstTimerGuide data extraction | 5 stock recipes (`standard-oven-decarb`, `quick-sous-vide`, `coconut-oil-infusion`, `light-avb-tincture`, `beginner-olive-salve`) + `StockRecipeCard` component + `data/stockRecipes.ts` + `data/decbMethodCards.ts` (extracted from FirstTimerGuide) + `data/equipmentOptions.ts` (13 entries extracted) + `resumeLastInFlight` + `rerunRecipe` actions + persist v9→v10 migration + "Run again" CTA on `CompletionStep` + Dashboard "Resume last" + "Try a starter recipe" sections |
| 7 | Polish — accessibility, error states, edge cases + §8.1 re-edit UX | `validateWizardSelections(branch, selections)` pure helper + `rerunRecipe` defensive against bad branch + `useReducedMotion()` gate on the stepper's `scale-[1.005]` + `TransitionStep`'s `toast-in` animation + visible focus rings on all stepper CTAs + `sr-only` `aria-live` region announcing current-step changes + wire validation into `WizardScreen` (gates Begin batch, inline error display with `role="alert"`) + empty-selection guard + `onRerun` handler + Flower-servings validation fix (the Week 7 spec's "non-Topical" rule was wrong; only Edible / Concentrate / AVB have `servingsStep`) + `matchMedia` stubs in 2 test files (JSDOM doesn't ship matchMedia; the new `useReducedMotion()` reads it on mount) |
| 7+ (post-build) | Full-codebase review for stubs/mocks/dead code | Deleted `comingSoonStep` (Week 1 "Coming in week 2" placeholder, dead since Week 2 wired all 5 branches) + updated 5 files of stale "Week N" comments + identified 30 `TODO(citation)` engine gaps as known documentation audit findings (not stubs) + 4 `FUTURE-API` markers as honest future-work labels (per the 2026-07-26 user pushback "zero consumers means that you've failed to do your job", these are wiring gaps that future cycles will close) |

## What's left for Week 8 (per `docs/wizard-architecture-2026-07-26.md` §7)

> **Week 8: Beta test with 2-3 medical-marijuana patients from the target user group.** Includes real-user validation of the §8.4 plain-language product-type labels — iterate from the feedback.

This is non-code. The 5 product-type labels are:
- "From raw flower" (was: "Flower (decarbed)")
- "From concentrate or hash" (was: "Concentrate")
- "From already-used flower (AVB)" (was: "AVB (already vaped bud)")
- "For an edible or recipe" (was: "Edible (infused fat/oil)")
- "For a skin or topical product" (was: "Topical")

The wizard ships behind the `wizardEnabled` feature flag in DevTools (per the Week 1 brief). Flip the flag to opt in.

## Deferred to follow-up cycles (flagged in the codebase review)

These were intentionally not in the Weeks 1-7 scope; each is documented in the codebase review commit body (`e00578c`):

1. **FirstTimerGuide tab deprecation per §8.6** — the data extraction landed in Week 6 (`decbMethodCards.ts` + `equipmentOptions.ts`); the tab itself still mounts in `main.tsx:295` with a header CTA at `main.tsx:289`. Practical scope: hide the tab behind a `firstTimerGuideEnabled` flag, update the `StartupRouting` test that references it.

2. **QuickBatchTab migration per §7 Week 6** — the tab is still fully wired; the practical scope is a banner at the top that says "Try the new wizard" + a CTA that opens the wizard at the product-type picker with the same selections pre-filled.

3. **Wiring the 4 `FUTURE-API` engine surfaces** — `parseLabTextStrict` (batch-mode lab-text import), `saveRecipe` / `loadRecipe` (Recipe import/export UI on Dashboard), `reverseDecarb` (any future decarb-only reverse flow). These have tests but no production consumers; future Dashboard widgets should call them.

4. **30 `TODO(citation):` engine gaps** — documentation gaps from a prior academic-citation audit (`research/academic-references.md`). Not stubs. Tracked audit findings to be addressed when the citation work resumes.

5. **Stage 2 path for non-Flower branches** (Concentrate / AVB / Edible / Topical) — only the Flower branch has Stage 2 work today. The other branches render the "No steps to run" empty state when the user finishes a non-Flower branch. Tracked in `stage2Steps.ts:174` as a deferred build-order item.

## Memory entries written this session

The following are now in `~/.mavis/agents/mavis/memory/MEMORY.md` for future ccc dispatches:

- **"ccc bespoke-agent false-success pattern"** (updated Week 3 + Week 5) — the 3-agent pattern works for Weeks 1-4, 6, 7; the Week 5 first dispatch was a 14-minute false success that needed a tighter-scope retry.
- **"Validation rules must match the actual branch sequence"** (Week 7) — when writing a validator prompt for a multi-step flow, anchor the rule to the canonical sequence table, not a free-text rule like "non-Topical".
- **"`window.matchMedia` stub leak when `useReducedMotion` is added"** (Week 7) — JSDOM doesn't ship matchMedia; the stub is cheap but easy to miss because JSDOM silently allows calls outside the React mount lifecycle.
- **"Validation rules must match the actual branch sequence" + the prior 2026-07-26 "Zero consumers = unfinished work"** — every agent prompt for a ccc task now knows to read the sequence table, not a free-text rule, and not to delete zero-consumer code.

## Verification commands

```bash
cd C:/Users/LEWIS/ccc/cannabis_chemistry_calculator
pnpm typecheck                                  # clean
pnpm test --run                                  # 85 files / 1559 tests passing
git log --oneline origin/master..HEAD            # 0 (working tree clean, on origin)
git log --oneline -10                            # the latest 10 wizard build commits
```

## Chain summary (54 commits, Weeks 3-7 + review)

```
e00578c refactor(ccc): delete comingSoonStep dead code + update stale Week N comments
a81d666 fix(ccc): Week 7 polish follow-up — Flower validation + matchMedia stubs (Week 7)
2753198 feat(ccc): wire validation + empty-selection guard + onRerun handler (Week 7)
c0a893e feat(ccc): validateWizardSelections + rerunRecipe edge cases (Week 7)
e12a25f feat(ccc): a11y polish — reduced motion + focus rings + sr-only announce (Week 7)
b64093a feat(ccc): stockRecipes + equipmentOptions + decbMethodCards + Dashboard Resume/Stock wire (Week 6)
9887ebb feat(ccc): resumeLastInFlight + rerunRecipe actions + persist v10 (Week 6)
cffb062 feat(ccc): CompletionStep Run-again CTA + StockRecipeCard component (Week 6)
1d54c3b feat(ccc): wire infusion + completion + save recipe flow (Week 5)
cae0f30 feat(ccc): recipes[] slice + persist v9 + JournalEntry link (Week 5)
06a961a feat(ccc): NameRecipeStep component + deriveDefaultRecipeName (Week 5)
f94c2b8 fix(ccc): main.test.tsx wizardEnabled flake + Stage 2 disableWizard (Week 4)
e0cd1d5 feat(ccc): wire timer + transition + re-edit recalculating in Stage 2 (Week 4)
7b8a35f feat(ccc): Stage 2 recalculating flag for §8.1 re-edit UX (Week 4)
e0e70cc feat(ccc): recalculating badge + data-recalculating hooks for §8.1 (Week 4)
66c4818 feat(ccc): wire Stage 2 transition + decarb preheat/heatmap data flow (Week 3)
51f8d89 feat(ccc): Stage 2 execution slice + actions (Week 3)
c51c4d9 feat(ccc): data-testid hooks for Stage 2 stepper integration tests (Week 3)
... [Weeks 1-2 + earlier context] ...
```
