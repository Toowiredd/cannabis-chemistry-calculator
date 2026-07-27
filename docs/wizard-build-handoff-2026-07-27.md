# ccc wizard build — Weeks 1-7 complete (Week 8 pending real-user validation) + v2.2 UI/UX rebuild (slides 1-8)

## Status: 62 commits ahead of `origin/master` as of 2026-07-27

All committed, pushed, and verified:
- 86 test files / 1567 tests passing (was 76 / 1361 at the start of Week 3)
- `pnpm typecheck` clean
- Working tree clean
- Branch `master` up to date with `origin/master`

## v2.2 UI/UX rebuild (2026-07-27, slides 1-8)

The Weeks 1-7 wizard was functionally complete but the UI/UX was a flat "make a batch" multi-step view that crammed every step into one window. The user called it out as not a slide show and demanded a step-by-step rebuild. The v2.2 work landed in 8 slides, each a small targeted change reviewed live on the Tailscale Funnel deployment:

| Slide | What shipped | Commit |
|---|---|---|
| 1 | 3D end-product coverflow (5 category faces: Baked/Gummies/Capsules/Tincture/Salve) replacing the flat product-type row | `eb20634` + `f825ec3` (rename "Brownies" → "Baked") |
| 2 | Drop Methods tab from both reference rails; lighten all glass utilities (blur 12-14px → 4-8px, saturate 160-180% → 120%, bg/border/shadow halved); sharpen animated background gradients | `587a915` |
| 3 | wizardEnabled default flip to `true` (wizard IS the UX); persist v10→v11 migration forces any persisted envelope to wizardEnabled: true; FirstTimerGuide render gate returns null when wizardEnabled is true; 8 test files updated | `0dcc1a3` |
| 4 | Wizard is a SLIDE SHOW: `Wizard.tsx` renders ONLY the current step's StepCard (no collapsed past/future siblings, no back button); step counter "1 / 7" top-right; "Make a batch" header + "Reset wizard" button kept; `onEdit` prop dropped; 3 test files updated to match the slide-by-slide view | `c7ab1a3` |
| 5 | Drop the outer `<GlassCard>` on active steps (user called it "the biggest glass panel"); replace with plain flex-column div; OptionTile cards keep their own chrome | `807a49d` |
| 6 | Carousel treatment on every step: extract 3D coverflow into generic `Carousel`; create `OptionCarousel` for option tiles; `EndProductCoverflow` refactored to use Carousel; per-step Confirm button GONE (one-tap to commit); coverflow spacing widened from ±170/±300 to ±210/±360 (user: "too tightly bunched up") | `3efce3f` |
| 7 | Drop outer wizard glass: main.tsx `glass-strong` layer made conditional (opacity-0 when wizardEnabled is true); Carousel face dimensions became CSS custom properties via `clamp()` for fluid responsive sizing | `5b50349` |
| 8 | Carousel tiles sized to fill the space: take 3 of the responsive formula (take 1 tiny, take 2 huge with content floating in empty space). Take 3: width `clamp(0.7 * base, 30vw, 1.45 * base)`, height derived from width with fixed aspect ratio, side offsets reduced from 0.78x/1.32x to 0.62x/1.05x | `df4c0e9` |

**Net v2.2 result** — 3D coverflow landing (5 end-product category faces) → step-by-step carousel (one step in the DOM at a time, side faces peek behind, no back button, step counter top-right) → terminal "Begin batch" CTA → Stage 2 execution stepper. Every slide uses the same carousel treatment; no glass panels in the way; the animated background reads through; tiles fill the available space on every viewport from 800x700 to 1920x1080. Live at `https://laptop.tail646a73.ts.net/ccc/`. Build: `index-I94fivxI.js`.

### v2.2 key design decisions

- **The wizard is the UX, not an overlay** — `wizardEnabled: true` is the default. The flag exists ONLY for emergency rollback; the user has said this 3+ times in the session and called out the framing as the most important decision.
- **Categories, not recipes** — Coverflow faces are categories (Baked covers brownies/cookies/cakes/pancakes/muffins), not individual recipes. The user pushback on "Brownies" was a teaching moment that applies to all 5 faces.
- **Slide show, not stacked view** — Only the current step in the DOM. No collapsed-with-selection breadcrumbs, no future-step previews, no back button. The step counter is the only navigation chrome.
- **Aesthetic stays** — Glassmorphism dark is a hard constraint. No new design tokens introduced. The animated background radial blobs are the main visual element; the carousel faces are the only structured content.
- **One tap to commit** — Click any carousel face → onSelect fires → wizard advances. No separate "Confirm" button on slides 2+. The coverflow keeps its own "Make {name}" confirm because the coverflow benefits from a deliberate "I've browsed, now commit" affordance.
- **Responsive sizing** — Carousel face dimensions are CSS custom properties derived from `clamp()` and viewport width. Side-face offsets are proportional to the face width. Tiles scale fluidly from ~280px on a phone to ~520px on a 1920px desktop.
- **The glass is gone** — The outer wizard panel had a `glass-strong` layer that survived the active-step GlassCard removal. Made conditional: opacity-0 when wizardEnabled is true. The wizard sits on the bare page background so the radial-gradient blobs read through.

### v2.2 key memory entries

- **"Coverflow faces must be CATEGORIES not RECIPES"** (2026-07-27) — Brownies → Baked (covers brownies/cookies/cakes/pancakes/muffins). Apply category-level thinking to all 5 faces.
- **"Lighten glassmorphism + sharpen animated backgrounds"** (2026-07-27) — Specific CSS values for the glass lightening and background sharpening.
- **"ccc wizard default flipped: wizard IS the UX"** (2026-07-27) — Explicit warning: user has said this 3+ times. Don't frame the wizard as opt-in/preview/flag/overlay.
- **"ccc wizard is a SLIDE SHOW, not a stacked view"** (2026-07-27) — Only current step in DOM. No collapsed siblings. "Make a batch" header + "Reset wizard" button + step counter are the only chrome. Recovery from validation error goes through "Reset wizard".
- **"ccc active step has NO outer GlassCard"** (2026-07-27) — User flagged the GlassCard as "the biggest glass panel that encapsulates the modals and panels, tiles" and asked for it removed (or 0 opaqueness) for every wizard slide.
- **"ccc Carousel extracted + OptionCarousel added"** (2026-07-27) — When a visual pattern is established for one element, apply it consistently across the same context. Don't ship a mixed treatment (coverflow vs flat row) for related elements.

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
- **"Coverflow faces must be CATEGORIES not RECIPES"** (2026-07-27, v2.2 slide 1) — Brownies → Baked (covers brownies/cookies/cakes/pancakes/muffins). The user pushback was a teaching moment that applies to all 5 faces, not just the called-out one.
- **"Lighten glassmorphism + sharpen animated backgrounds"** (2026-07-27, v2.2 slide 2) — Specific CSS values: blur 12-14px → 4-8px, saturate 160-180% → 120%, bg/border/shadow halved; background opacities 0.06-0.08 → 0.16-0.22, fall-off 40-50% → 24-32%.
- **"ccc wizard default flipped: wizard IS the UX"** (2026-07-27, v2.2 slide 3) — Explicit warning: user has said this 3+ times. Don't frame the wizard as opt-in/preview/flag/overlay. A build-time default flip is fine; the flag is for rollback only.
- **"ccc wizard is a SLIDE SHOW, not a stacked view"** (2026-07-27, v2.2 slide 4) — Only current step in DOM. No collapsed-with-selection siblings, no future-step previews, no back button. "Make a batch" header + "Reset wizard" button + step counter "1 / 7" are the only chrome. Recovery from a validation error goes through "Reset wizard".
- **"ccc active step has NO outer GlassCard"** (2026-07-27, v2.2 slide 5) — User flagged the GlassCard as "the biggest glass panel that encapsulates the modals and panels, tiles" and asked for it removed (or 0 opaqueness) for every wizard slide. Fix: replace the GlassCard wrapper with a plain flex-column div. OptionTile cards keep their own chrome.
- **"ccc Carousel extracted + OptionCarousel added"** (2026-07-27, v2.2 slide 6) — When a visual pattern is established for one element, apply it consistently across the same context. Don't ship a mixed treatment (coverflow vs flat row) for related elements.
- **"Don't jump to the first interpretation"** (cross-project) — User has corrected me multiple times in one session for jumping to my first interpretation. Before committing, surface 2-3 plausible readings and ask.
- **"Multiple concurrent LLMs — paste errors look like rejections"** (cross-project) — User runs Mavis alongside other LLM sessions. When "wrong" comes right after a fresh paste, a one-line clarifying question beats an immediate pivot.

## Verification commands

```bash
cd C:/Users/LEWIS/ccc/cannabis_chemistry_calculator
pnpm typecheck                                  # clean
pnpm test --run                                  # 86 files / 1567 tests passing
git log --oneline origin/master..HEAD            # 0 (working tree clean, on origin)
git log --oneline -10                            # the latest 10 wizard build commits
```

## Chain summary (62 commits, Weeks 3-7 + review + v2.2 rebuild slides 1-8)

```
df4c0e9 refactor(ccc): slide 8 of v2.2 — carousel tiles sized to fill the space
5b50349 refactor(ccc): slide 7 of v2.2 — drop outer wizard glass + responsive carousel
3efce3f refactor(ccc): slide 6 of v2.2 — carousel treatment on every step
807a49d refactor(ccc): slide 5 of v2.2 — drop the outer GlassCard on active steps
c7ab1a3 refactor(ccc): slide 4 of v2.2 — the wizard IS a slide show
0dcc1a3 refactor(ccc): slide 3 — the wizard IS the UX (default flip)
587a915 refactor(ccc): slide 2 — drop Methods tab + lighten glass + sharpen bg
f825ec3 fix(ccc): rename brownies face to baked — category, not recipe
eb20634 feat(ccc): slide 1 of v2.2 — 3D end-product coverflow at wizard landing
3f444c7 fix(ccc): dynamic Router basename + direct-local-access hint
6397455 fix(ccc): PWA static server — strip /ccc prefix for direct local access
3b7c04e Revert "feat(ccc): the wizard IS the UI/UX — default wizardEnabled: true"
1455d1d feat(ccc): the wizard IS the UI/UX — default wizardEnabled: true
a5b2c9c docs(ccc): the wizard IS the UI/UX — drop opt-in / overlay / staged-rollout framing
07d3f80 docs(ccc): reframe wizard to recipe-style model (carousel entry, end product, no yes/no follow-ups, glassmorphism preserved)
... [Weeks 1-7 + earlier context] ...
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
```
