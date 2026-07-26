# Wizard Architecture — 2026-07-26

_Redesign of the ccc primary navigation. Status: PROPOSAL — awaiting sign-off before implementation._

## 1. Why this exists

The Cannabis Chemistry Calculator (ccc) is for **beginners and people who need confident, repeatable workflows** for making cannabis products at home for medical marijuana. The current 3D coverflow + 9 tabs architecture solves the wrong problem: it presents the full calculation UI in every face of the carousel, which is decision fatigue, not a confident workflow. A user picking the Oven Decarb method doesn't need to see the THCA slider, the timer input, the journal save button, and the dose calculation result at the same time — they need **one decision at a time, in a sequence that builds confidence**.

The redesign replaces the coverflow with a two-stage flow:

- **Stage 1 — Configuration wizard:** a vertical stack of step cards, each with a horizontal option carousel scoped to that step. Selections snap-shut the card and reveal the next.
- **Stage 2 — Execution carousel:** a step-by-step "do this now" view with one step per face, focused on visuals (gauges, timers, prompts) rather than decisions. Re-executable from a saved config.

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

## 4. Stage 2: Execution carousel

A separate `<ExecutionCarousel>` — one step per face, full-screen, focused on the user's current action.

### 4.1 Step UI shapes

| Step type | UI shell | Example |
|---|---|---|
| **Pre-action** | Large text + button ("Preheat oven to 105°C" + "I'm ready" CTA) | Method-confirmation step |
| **Active timer** | Gauge + countdown + "Stir now" alert | 45-min decarb timer |
| **Visual state** | 3D molecular / heatmap / bag fill | "Material is decarbed" confirmation |
| **Transition** | Brief animation + next-step CTA | "Move to infusion" |
| **Completion** | Result summary + journal save CTA | "Batch complete" |

The current `DecarbHeatmap` and `MolecularBuilder` widgets become the **Visual state** shells. The `Timer` becomes the **Active timer** shell. The shells are reusable; the wizard's `selections` feed them.

### 4.2 Carousel mechanics

- One step visible at a time.
- Horizontal swipe / left-right button navigates between steps.
- Can't skip forward (must complete each step to advance).
- Can rewind to review a previous step; going forward re-confirms.
- "Back to config" button at the top returns to Stage 1's last-active step (re-edit mode).

### 4.3 Reusability

Stage 2 reads the Stage 1 `WizardState` to render. A saved Recipe is just a persisted `WizardState`; **"Re-run" loads it → renders the same Stage 2 with the same selections**. This is the "repeatable workflow" promise: same Recipe → same execution.

## 5. Migration from current architecture

### 5.1 What gets replaced

- `src/renderer/src/components/TabCarousel.tsx` — Stage 1 wizard skeleton replaces it for the workflow group; Stage 2 reuses the coverflow-style carousel for execution
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
- `src/renderer/src/components/ExecutionCarousel.tsx` — Stage 2 shell
- `src/renderer/src/components/execution/PreheatStep.tsx` — pre-action shell
- `src/renderer/src/components/execution/TimerStep.tsx` — active-timer shell (wraps existing `Timer.tsx`)
- `src/renderer/src/components/execution/HeatmapStep.tsx` — visual-state shell (wraps `DecarbHeatmap.tsx`)
- `src/renderer/src/components/execution/CompletionStep.tsx` — result + journal save shell

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
| First Timer Guide | **Deprecated** — the Wizard's product-type step IS the entry point. Users no longer need to know "go to First Timer Guide first." |

## 6. Persistence

- Wizard state: `appStore.wizard` slice (new), persisted in the same `ccc-app-state` localStorage key
- Recipe (completed wizard config + computed totals): `appStore.journalEntries[]` with a new `Recipe` type, or a separate `recipes[]` slice (TBD)
- IDB mirror: extend the existing IndexedDB mirror pattern to include recipes
- Migration: existing users' localStorage → v8 migration that drops `firstTimerOpen`/`wizard.active` (the old wizard alias), introduces `wizard.state` (the new shape), keeps `journalEntries[]` as-is for backward compat

## 7. Build order (8 weeks, phased)

| Week | Deliverable |
|---|---|
| 1 | Design doc sign-off + Wizard skeleton + Product-type step (one branch end-to-end with one decision step). Behind a feature flag. |
| 2 | Branch taxonomy + smart-skip logic. All 5 branches navigable; the Flower branch has all 5 steps wired with options. |
| 3 | Stage 2 skeleton + one execution step (decarb preheat + heatmap visual). |
| 4 | Stage 2 full decarb execution path (timer, "stir now", heatmap updates, transition to infusion). |
| 5 | Stage 2 infusion + dose execution steps. Recipe save (persists the WizardState). |
| 6 | "Resume last" entry + "Re-run saved Recipe" UX. Migrate QuickBatchTab users to the new flow. |
| 7 | Polish — accessibility (keyboard, screen reader, reduced motion), error states, edge cases. |
| 8 | Beta test with 2-3 medical-marijuana patients from the target user group. Iterate. |

## 8. Open questions (for sign-off)

1. **Re-edit during Stage 2:** if the user changes a selection mid-execution (e.g., changes the temperature override), does Stage 2 re-render the affected steps? Or do they have to go back to Stage 1 to re-edit? Proposal: re-edit is allowed in Stage 2 but flagged with a "recalculating..." indicator. Saves the user a back-and-forth.

2. **Multi-batch UX:** the user wants to make 3 batches of the same recipe. Do they run the Wizard 3 times (3 separate Recipes) or does Stage 2 support a "next batch" CTA that resets the timer without leaving the carousel? Proposal: separate Recipes + a "Run again" CTA at completion.

3. **Stock recipes vs custom:** the Methods tab can show stock recipes (curated by us). Should Stage 1 also have a "use a stock recipe" path that skips the wizard? Proposal: yes, as a separate entry point on the Dashboard, not a wizard mode.

4. **Onboarding for first-time users:** the wizard's product-type picker is the natural first-time experience, but is it obvious that "Flower (decarbed)" means "I have raw flower and want to decarb it"? Needs user-testing with 2-3 real beginners.

5. **Save destination:** the wizard's completed Recipe goes to the Journal automatically, but should the user see a "name this recipe" step? Proposal: yes, brief, with a default name derived from the selections ("Oven Decarb, 28g, Coconut Oil").

6. **FirstTimerGuide deprecation:** the audit found FirstTimerGuide has 1876-line method cards with hardcoded `°C` (P1.3) and fat-volume mL-only (P1.3). Deprecating means dropping that work. The wizard's per-step explanations are richer AND more contextual. OK with that?

## 9. What this doc does NOT cover

- Visual design language (colors, typography, animations) — the existing glassmorphism + dark mode language applies. Stage 2 may benefit from higher-contrast "in-progress" states.
- Onboarding beyond the wizard entry — a separate doc, after the wizard ships.
- Multi-user / shared recipes — out of scope for v1.
- Commercial-scale features (batch tracking, lab integration) — out of scope.
- Voice / accessibility beyond keyboard + screen reader — future.

## 10. Sign-off

This doc needs your sign-off before implementation starts. Specifically the 6 open questions in §8. The build order in §7 is the proposed path; the weeks are estimates, not commitments.
