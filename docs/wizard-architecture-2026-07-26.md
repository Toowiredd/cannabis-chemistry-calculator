# Wizard Architecture — 2026-07-26

_Redesign of the ccc primary navigation. **Status: SIGNED OFF on the user's behalf (2026-07-26)** — the 6 open questions in §8 were resolved per explicit delegation. Implementation can begin per the build order in §7._

## 0. v2.2 UI/UX rebuild (2026-07-27) — 8 slides shipped

The Weeks 1-7 build implemented the architecture above but the UI/UX was a flat "make a batch" multi-step view that crammed every step into one window. The user called it out as not a slide show and demanded a step-by-step rebuild. The v2.2 work landed in 8 slides, each a small targeted change reviewed live on the Tailscale Funnel deployment. See `docs/wizard-build-handoff-2026-07-27.md` for the full slide-by-slide build log.

**Key v2.2 changes that revised this architecture doc:**

1. **End-product coverflow replaces the 5-product-type row** (slide 1, commit `eb20634` + `f825ec3`) — The "Step 0" picker is a 3D coverflow of 5 **end products** (Baked / Gummies / Capsules / Tincture / Salve — all CATEGORIES, not recipes; the "Brownies" → "Baked" rename was the teaching moment that applies to all 5 faces). 3 end products map 1:many to the `edible` branch (Baked/Gummies/Capsules), Tincture → `avb`, Salve → `topical`. The architecture doc's §3.1 product-type picker (the 5 starting-material branches) is now the underlying state, not the user-facing primary decision.
2. **Wizard is a SLIDE SHOW, not a vertical stack of step cards** (slide 4, commit `c7ab1a3`) — §3.2's "vertical stack of step cards" is replaced by a slide-by-slide renderer: `Wizard.tsx` renders ONLY the current step's StepCard. No collapsed-with-selection siblings for past steps, no collapsed preview for future steps, no back button. The step counter "1 / 7" in the top-right is the only navigation chrome. The "Make a batch" header + "Reset wizard" button are kept (per user feedback — only the collapsed future steps were the problem).
3. **3D carousel treatment on every step, not just the coverflow** (slide 6, commit `3efce3f`) — §3.2's "horizontal option carousel" is replaced by a 3D perspective carousel shared with the coverflow. The generic `Carousel` component owns the 3D geometry (perspective 1400px + 5 face positions + rotateY/translateX/translateZ/opacity + keyboard nav + one-tap commit + wrap at ends for ≥5 items). The `OptionCarousel` uses the same 3D pattern for option tiles (Method/Container/Weight/Fat/Volume/Servings/Carrier/Color/Application area, etc.).
4. **Glassmorphism lightened + per-step "Confirm" button removed** (slides 2 + 6, commits `587a915` + `3efce3f`) — §7's "glassmorphism dark" aesthetic is preserved but the per-step "Confirm" button is gone (the option carousel is one-tap to commit). Per-card `backdrop-blur-xl` (24px) → `backdrop-blur` (4px); glass utilities lightened (blur 12-14px → 4-8px, saturate 160-180% → 120%, bg/border/shadow halved).
5. **Active step has NO outer GlassCard** (slide 5, commit `807a49d`) — §3.2's "StepCard" with a "GlassCard" wrapper for the active state is replaced by a plain flex-column div. OptionTile cards keep their own chrome (border + bg + hover) so the visual rhythm of the carousel is preserved.
6. **Outer wizard panel has NO glass** (slide 7, commit `5b50349`) — `main.tsx`'s `glass-strong` layer is conditional: opacity-0 when `wizardEnabled` is true (wizard is the surface), opacity-100 with `glass-strong` when false (legacy GroupedTabNav).
7. **Responsive carousel sizing** (slides 7-8, commits `5b50349` + `df4c0e9`) — Carousel face dimensions are CSS custom properties derived from `clamp()` and viewport width. Tiles scale fluidly from ~280px on a phone to ~520px on a 1920px desktop. Side-face offsets proportional to the face width.

**Net v2.2 result:** The wizard renders as a 3D coverflow landing (5 end-product category faces) → a step-by-step carousel (one step in the DOM at a time, side faces peek behind, no back button, step counter top-right) → terminal "Begin batch" CTA → Stage 2 execution stepper. The reference rail lost the Methods tab (the wizard's Method step covers it). Live at `https://laptop.tail646a73.ts.net/ccc/`. Build: `index-I94fivxI.js`.

## 1. Why this exists

The Cannabis Chemistry Calculator (ccc) is for **beginners and people who need confident, repeatable workflows** for making cannabis products at home for medical marijuana. The current 3D coverflow + 9 tabs architecture solves the wrong problem: it presents the full calculation UI in every face of the carousel, which is decision fatigue, not a confident workflow. A user picking the Oven Decarb method doesn't need to see the THCA slider, the timer input, the journal save button, and the dose calculation result at the same time — they need **one decision at a time, in a sequence that builds confidence**.

The redesign replaces the coverflow with a two-stage flow:

- **Stage 1 — Configuration wizard:** a vertical stack of step cards, each with a horizontal option carousel scoped to that step. Selections snap-shut the card and reveal the next.
- **Stage 2 — Execution stepper:** a vertical list of process steps, all visible at once, current step highlighted, "Mark complete" per step. Focused on visuals (gauges, timers, prompts) rather than decisions. Re-executable from a saved config.

A **Reference rail** (Methods / Advanced / Knowledge / Journal) stays as the library side — unchanged.

## 2. Target user (re-stated)

- Beginners with no prior chemistry knowledge
- People who need confidence in their setup (no surprises in the process)
- People who need repeatability (the same recipe produces the same result every time)
- Personal home use, not commercial
- Medical marijuana (quality matters more than recreational)

Every design decision below should be testable against this target user: does the 5–7-step setup feel like a guided procedure or like filling out a tax form? Does the execution view let the user focus on what they're doing right now, or does it constantly re-prompt for decisions they already made?

## 3. Stage 1: Configuration wizard

### 3.1 Branch taxonomy

The wizard starts with a single "product type" decision. The five branches:

| Branch | Use case | Steps after product type |
|---|---|---|
| **Flower (decarbed)** | Decarb flower, then optionally infuse | Method → Container → Weight → Efficiency → (optional: Infusion Fat → Volume) → Start |
| **Concentrate** | Skip decarb, dose from concentrate | Potency → Carrier → Volume → Servings → Start |
| **AVB (already vaped bud)** | Repurpose already-decarbed material | Color → Carrier → Volume → Servings → Start |
| **Edible (infused fat/oil)** | Decarb + infuse + dose into recipe | Method → Container → Weight → Fat → Volume → Servings → Start |
| **Topical** | Infusion only, no decarb | Carrier → Volume → Application area → Start |

Smart-skip rules:
- AVB skips Method (already decarbed)
- Concentrate skips Decarb entirely
- Topical skips Decarb
- Servings skipped for non-dose-able products (topicals, some AVB uses)

### 3.2 Step card states

Each step is a `<StepCard>` with three states:

- **Collapsed (not yet active):** grayed-out preview of the step name + a chevron.
- **Active (currently being decided):** full card with title, the option carousel inside, and a "Confirm" CTA.
- **Collapsed-with-selection (done):** green check + the chosen option, tap to re-edit.

The option carousel inside the active card is a horizontal scroll-snap of `<OptionTile>` cards. Each tile is a 2-line summary (name + 1 key attribute) with a tap target. **No sliders, no inputs, no multi-field forms** in Stage 1 — those are computed downstream from the wizard's state in Stage 2 (timer, gauge, "stir now" prompt).

### 3.3 State machine

```ts
type WizardState = {
  branch: 'flower' | 'concentrate' | 'avb' | 'edible' | 'topical' | null
  currentStep: number
  selections: Partial<{
    method: DecarbMethodId
    container: BagPresetId
    weight: { value: number; unit: 'g' | 'oz' }
    efficiency: number
    fat: FatId
    volume: { value: number; unit: 'mL' | 'cup' | 'tsp' | 'tbsp' }
    servings: number
    potency: number          // for concentrate
    color: AvbColor          // for AVB
    applicationArea: string  // for topical
    carrier: CarrierId       // for topical
  }>
}
```

State persisted to localStorage + IndexedDB on every selection (atomic write; IDB backup on app close). A **Recipe** is a saved `WizardState` + computed totals (engine calculates totals on completion; only selections are user-editable, totals are derived).

### 3.4 Step definition pattern

Each step is defined declaratively so the wizard can be reconfigured per branch without code changes:

```ts
type WizardStep = {
  id: string                              // 'method' | 'container' | ...
  title: string                           // "Decarb Method"
  description: string                     // 1-line "what this means" for beginners
  getOptions: (state: WizardState) => Option[]
  validate: (state: WizardState) => boolean
  skipIf: (state: WizardState) => boolean
}
```

The wizard's step sequence is `branches[state.branch].steps` — each branch returns its ordered list. The "product type" picker is a special step 0 with no `skipIf`, always shown.

### 3.5 Entry + resume

- App launch with no saved Recipe: jump to product-type step 0.
- App launch with a saved Recipe: Dashboard offers "Resume last" (→ Stage 2 directly) vs "Start new" (→ product-type step 0).
- Mid-wizard abandon: persisted state restored on next launch, scroll to last-active step.

## 4. Stage 2: Execution stepper

A vertical `<ExecutionStepper>` — all steps visible as a scrollable list, current step highlighted, "Mark complete" per step, progress bar at the top. Like a recipe app (NYT Cooking, Allrecipes) or IKEA assembly instructions. No carousel, no swipe, no hidden steps.

### 4.1 Step UI shapes

| Step type | UI shell | Example |
|---|---|---|
| **Pre-action** | Large text + button ("Preheat oven to 105°C" + "I'm ready" CTA) | Method-confirmation step |
| **Active timer** | Gauge + countdown + "Stir now" alert | 45-min decarb timer |
| **Visual state** | 3D molecular / heatmap / bag fill | "Material is decarbed" confirmation |
| **Transition** | Brief animation + next-step CTA | "Move to infusion" |
| **Completion** | Result summary + journal save CTA | "Batch complete" |

The current `DecarbHeatmap` and `MolecularBuilder` widgets become the **Visual state** shells. The `Timer` becomes the **Active timer** shell. The shells are reusable; the wizard's `selections` feed them.

### 4.2 Stepper mechanics

- All steps visible in a vertical list (the user sees the whole process at once, like a recipe).
- Current step is highlighted (color, gentle scale, sticky scroll-to-top when navigating).
- Each step has its own "Mark complete" CTA; tapping advances the current step to the next.
- Completed steps collapse to a compact summary ("✓ Preheat to 105°C, 12:34 pm") — they stay visible for reference but don't take up screen real estate.
- For longer processes (decarb + infuse + dose = 10+ steps), steps are grouped by phase (Decarb / Infusion / Dose) and the current phase is expanded; previous phases collapse to their completion summary.
- Progress bar at the top ("3 of 7 steps complete").
- "Back to config" button at the top returns to Stage 1's last-active step (re-edit mode).
- "Skip" allowed only for steps that have a `skipIf` predicate (e.g., decarb timer is skippable if the user already decarbed offline).

### 4.3 Reusability

Stage 2 reads the Stage 1 `WizardState` to render. A saved Recipe is just a persisted `WizardState`; **"Re-run" loads it → renders the same Stage 2 with the same selections**. This is the "repeatable workflow" promise: same Recipe → same execution.

## 5. Migration from current architecture

### 5.1 What gets replaced

- `src/renderer/src/components/TabCarousel.tsx` — Stage 1 wizard skeleton replaces it for the workflow group; the coverflow-style carousel is **not** reused for Stage 2 (Stage 2 is a vertical stepper, not a carousel — see §4)
- `src/renderer/src/components/GroupedTabNav.tsx` — re-architected to render `<Wizard />` + `<ReferenceRail />` (instead of coverflow + strip)
- `src/renderer/src/tabs/QuickBatchTab.tsx` — subsumed into the Wizard (its multi-step pattern is the foundation for Stage 1)

### 5.2 What gets split (decision vs execution surfaces)

- `src/renderer/src/tabs/DecarbTab.tsx` — decision surface (the form/inputs) moves into the Wizard's "Weight" + "Efficiency" steps; execution surface (the heatmap + timer) moves into Stage 2's decarb execution step
- `src/renderer/src/tabs/InfusionTab.tsx` — decision surface into "Fat" + "Volume" steps; execution surface (the infusion result) into Stage 2's infusion step
- `src/renderer/src/tabs/DoseTab.tsx` — decision surface into "Servings" step; execution surface into the completion + journal save step

### 5.3 What stays

- `MethodsTab.tsx`, `AdvancedToolsTab.tsx`, `KnowledgeTab.tsx`, `JournalTab.tsx` — the Reference rail, unchanged
- All engine functions — the wizard's selections feed the existing engine; engine surface is mostly reusable as-is
- `GlassCard` (refactored this session) — the visual primitive for both stages
- `<Alert>` (wired this session) — for inline form validation in any Stage 1 step where user-typed input is allowed (weight, custom override, etc.)

### 5.4 New components

- `src/renderer/src/components/Wizard.tsx` — the vertical step-stack container
- `src/renderer/src/components/StepCard.tsx` — single decision card with the 3 states
- `src/renderer/src/components/OptionTile.tsx` — the horizontal option carousel tile
- `src/renderer/src/components/ProductTypeTooltip.tsx` — the "what does this mean?" expander on each product-type label (per §8.4 plain-language onboarding)
- `src/renderer/src/components/ExecutionStepper.tsx` — Stage 2 vertical stepper shell
- `src/renderer/src/components/execution/PreheatStep.tsx` — pre-action shell
- `src/renderer/src/components/execution/TimerStep.tsx` — active-timer shell (wraps existing `Timer.tsx`)
- `src/renderer/src/components/execution/HeatmapStep.tsx` — visual-state shell (wraps `DecarbHeatmap.tsx`)
- `src/renderer/src/components/execution/CompletionStep.tsx` — result + journal save shell
- `src/renderer/src/components/StockRecipeCard.tsx` — the Dashboard entry for a stock recipe (per §8.3)
- `src/renderer/src/components/NameRecipeStep.tsx` — the "Name this recipe" wizard step with default placeholder from selections (per §8.5)
- `src/renderer/src/data/decbMethodCards.ts` — extracted from FirstTimerGuide's method card content (per §8.6)
- `src/renderer/src/data/equipmentOptions.ts` — extracted from FirstTimerGuide's `EQUIPMENT_OPTIONS` (per §8.6)
- `src/renderer/src/data/stockRecipes.ts` — curated starter recipes the Dashboard surfaces (per §8.3)

### 5.5 What this means for the existing 9 tabs

| Tab | New role |
|---|---|
| Dashboard | Unchanged (overview + inventory + "Resume last" CTA) |
| Quick Batch | **Subsumed** into the Wizard |
| Decarb | Split: decision → Wizard steps; execution → Stage 2 step |
| Infusion | Same split |
| Dose | Same split |
| Methods | Stays in Reference rail |
| Advanced Tools | Stays in Reference rail |
| Knowledge | Stays in Reference rail |
| Journal | Stays in Reference rail |
| First Timer Guide | **Deprecated** — the Wizard's product-type step IS the entry point. Users no longer need to know "go to First Timer Guide first." The useful data inside FirstTimerGuide (method cards, `EQUIPMENT_OPTIONS`) extracts to shared libraries (`src/data/decbMethodCards.ts`, `src/data/equipmentOptions.ts`) that the wizard's per-step explanations consume (per §8.6). |

## 6. Persistence

- **Wizard state:** `appStore.wizard` slice (new), persisted in the same `ccc-app-state` localStorage key
- **Recipe** (completed wizard config + computed totals + user-given name + date + batch journal entry): `appStore.recipes[]` slice (NEW — separate from `journalEntries[]` because each batch is its own record per §8.2). Each recipe carries: `id`, `name` (user-typed per §8.5), `selections: WizardState`, `computedTotals`, `createdAt`, `batchJournalEntryId` (FK to the journal entry for this batch)
- **Stock recipes** (per §8.3): static config in `src/renderer/src/data/stockRecipes.ts` (curated by us, versioned in the repo, NOT user-editable). The Dashboard renders them as a `StockRecipeCard` list; tapping one pre-fills the wizard's `selections` and goes to step 1 of Stage 1
- **IDB mirror:** extend the existing IndexedDB mirror pattern to include `recipes[]`
- **Migration:** existing users' localStorage → v8 migration that drops `firstTimerOpen` / `wizard.active` (the old wizard alias), introduces `wizard.state` (the new shape) + `recipes[]`, keeps `journalEntries[]` as-is for backward compat (each `Recipe.batchJournalEntryId` is a soft FK; if the journal entry is missing, the Recipe still renders)

## 7. Build order (8 weeks, phased)

| Week | Deliverable |
|---|---|
| 1 | Design doc sign-off + Wizard skeleton + Product-type step (one branch end-to-end with one decision step). Behind a feature flag. Product-type labels use the plain-language versions from §8.4 ("From raw flower" etc.) with the ProductTypeTooltip expander. |
| 2 | Branch taxonomy + smart-skip logic. All 5 branches navigable; the Flower branch has all 5 steps wired with options. |
| 3 | Stage 2 stepper skeleton + one execution step (decarb preheat + heatmap visual). |
| 4 | Stage 2 full decarb execution path (timer, "stir now", heatmap updates, transition to infusion). |
| 5 | Stage 2 infusion + dose execution steps. Recipe save: `NameRecipeStep` + `appStore.recipes[]` slice + IDB mirror. `journalEntries[]` linked via `Recipe.batchJournalEntryId`. |
| 6 | "Resume last" entry + "Re-run saved Recipe" UX. Stock recipes: `src/data/stockRecipes.ts` (3-5 curated starters) + `StockRecipeCard` on the Dashboard (pre-fills the wizard, doesn't skip it). Migrate QuickBatchTab users to the new flow. Extract FirstTimerGuide data into `decbMethodCards.ts` + `equipmentOptions.ts`. |
| 7 | Polish — accessibility (keyboard, screen reader, reduced motion), error states, edge cases. Re-edit during Stage 2 UX (per §8.1: inline re-edit with "recalculating..." indicator). |
| 8 | Beta test with 2-3 medical-marijuana patients from the target user group. Includes real-user validation of the §8.4 plain-language product-type labels — iterate from the feedback. |

## 8. Resolved decisions (signed off on the user's behalf 2026-07-26)

The 6 open questions are resolved. Decisions optimized for the target user (beginner + repeatable medical-marijuana workflow at home). All picks prioritized: (1) don't force a beginner to re-do work they can avoid, (2) keep the procedure repeatable and named, (3) reduce jargon to zero in the first-time experience.

### 8.1 Re-edit during Stage 2 — **YES, allow re-edit with a "recalculating..." indicator**

A medical-marijuana user mid-batch who realizes they set the wrong temperature should NOT be forced back to Stage 1 — that breaks the procedure. Re-edit is allowed inline on any step. The Stepper shows a "recalculating..." badge on every step affected by the change (the engine recomputes the totals, the affected steps re-render). The user keeps their place; downstream steps update. Confidence preserved.

### 8.2 Multi-batch UX — **Separate Recipes + "Run again" CTA at completion**

Every batch is its own Recipe record (date, selections, totals, journal entry). This is the "repeatable workflow" promise: the user can look back at past batches, compare results, see what worked. Stage 2's completion step has a "Run again" CTA that copies the current Recipe's selections into a new draft Recipe and restarts Stage 2 (no need to re-run the wizard if nothing changed). Repeatability = records + one-tap re-run.

### 8.3 Stock recipes vs custom — **Stock recipes as a Dashboard entry that PRE-FILLS the wizard, doesn't skip it**

A beginner who's nervous about the wizard should have a "guided shortcut" — pick a stock recipe (e.g., "Standard Oven Decarb — 28g, 105°C, 45 min") and have the wizard pre-fill with those values. The user reviews each step (sees what was chosen and why), can adjust anything, and only then transitions to Stage 2. This is the "trust but verify" path: the developer-curated defaults give the beginner a starting point, the wizard gives them control. Stock recipes are NOT a skip — they're a pre-fill. Lives on the Dashboard, not in the wizard itself.

### 8.4 Onboarding labels — **Plain-language labels + "what does this mean?" expander on every product type**

Jargon kills beginners. The product-type picker uses plain-language labels:
- "From raw flower" (was: "Flower (decarbed)")
- "From concentrate or hash" (was: "Concentrate")
- "From already-used flower (AVB)" (was: "AVB (already vaped bud)")
- "For an edible or recipe" (was: "Edible (infused fat/oil)")
- "For a skin or topical product" (was: "Topical")

Each label has a small "?" icon next to it that expands a 1-2 sentence definition in-place ("'AVB' is the material left in a dry-herb vaporizer after a session — already decarboxylated"). The user never leaves the screen to learn what a term means. Real-user testing with 2-3 beginners in week 7 of the build (the a11y polish week) to confirm the labels land; iterate from there.

### 8.5 Save destination — **"Name this recipe" step with default placeholder from selections**

A medical-marijuana user making "the morning dose recipe" and "the sleep edible recipe" needs to be able to find them again. The wizard's final step before "Start" is a "Name this recipe" prompt: a single text field with a default placeholder derived from the selections (e.g., "Oven Decarb, 28g, Coconut Oil"). The user types 1-3 words or accepts the default. Named Recipes go to the Journal + a new `recipes[]` slice (see §6). The name is the primary label in the Journal; the auto-derived summary is the secondary metadata.

### 8.6 FirstTimerGuide deprecation — **DEPRECATE the tab; EXTRACT the useful data**

FirstTimerGuide as a standalone tab goes away (deprecated). BUT the useful data inside it survives:
- The method card content (decoration method explanations, equipment lists) extracts to a shared `src/data/decbMethodCards.ts` library that the wizard's per-step explanations consume.
- The `EQUIPMENT_OPTIONS` list (oven, sous vide circulator, vacuum sealer, mason jar, probe thermometer) extracts to `src/data/equipmentOptions.ts` and is reused by the wizard's "what do I need?" hints.
- The wizard's per-step explanations are CONTEXTUAL ("you're picking the decarb method — here's what each one means and what you need") instead of standalone ("here's a card about decarb methods").

Net: no data lost, the work is reused, the standalone tab is gone. The 1876-line method card file is replaced by smaller, focused library files that the wizard composes per-step.

## 9. What this doc does NOT cover

- Visual design language (colors, typography, animations) — the existing glassmorphism + dark mode language applies. Stage 2 may benefit from higher-contrast "in-progress" states.
- Onboarding beyond the wizard entry — a separate doc, after the wizard ships.
- Multi-user / shared recipes — out of scope for v1.
- Commercial-scale features (batch tracking, lab integration) — out of scope.
- Voice / accessibility beyond keyboard + screen reader — future.

## 10. Sign-off

**Status: SIGNED OFF on the user's behalf (2026-07-26).** The 6 open questions in §8 were resolved per the user's explicit delegation ("make the most efficacious and rewarding choices for those 6 questions on my behalf"). Resolutions are documented in §8 with the target user (beginner + repeatable medical-marijuana workflow at home) as the compass.

Implementation can begin. The build order in §7 is the proposed path; the weeks are estimates, not commitments. Per the user's "design-doc-first" preference, no code lands until this doc is reviewed and the §8 decisions are confirmed — but the decisions are committed here, ready for review.
