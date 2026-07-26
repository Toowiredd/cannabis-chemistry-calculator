# Wizard — Week 1 evidence

The Stage 1 configuration wizard (per
`docs/wizard-architecture-2026-07-26.md` §3 + §7) is **feature-flagged
off by default**. Existing users see no change — the existing
GroupedTabNav continues to render the workflow carousel and
reference strip.

## What ships in Week 1

- **Product-type step** — the 5 plain-language options from §8.4:
  - "From raw flower"
  - "From concentrate or hash"
  - "From already-used flower (AVB)"
  - "For an edible or recipe"
  - "For a skin or topical product"
  Each has a `?` ProductTypeTooltip expander that shows the 1-2
  sentence definition in place.
- **Flower Method step** — the 6 real decarb methods from
  `engine/models.ts DECARB_METHODS`:
  - "Oven, sealed bag" (113°C, 60-90 min, 90-95% efficiency) —
    "Beginner-friendly" badge
  - "Oven, open tray" (116°C, 40 min, 88-95% efficiency)
  - "Sous vide, combined" (85°C, 240-360 min, 85-92% efficiency)
  - "Sous vide, fast" (95°C, 120-180 min, 95-98% efficiency)
  - "Sous vide, low-temp" (73°C, 480-720 min, 60-75% efficiency)
  - "Sous vide, dry" (95°C, 90-120 min, 95-98% efficiency) —
    "Best match" badge
- **Coming-soon placeholder** for the other 4 branches (concentrate,
  AVB, edible, topical). The brief says "for Week 1, only the Flower
  branch is end-to-end."
- **"Name this recipe" placeholder** at the end of the Flower
  branch. Full implementation lands in week 5 alongside
  `appStore.recipes[]`.

## How to enable for dev

The `wizardEnabled` flag + the `wizard` slice are owned by the
**state-routing rein** in a parallel commit. When their slice
lands, the field is `appStore.wizardEnabled: boolean` (default
`false`).

Until the slice lands, the wizard is permanently off — the
`WizardScreen` reads the field with a defensive type cast (see
`wizard/wizardFeatureFlag.ts`).

For local dev today, you can:

1. **Set via DevTools (renderer console)**: open the app, open
   DevTools, then run:
   ```js
   useAppStore = (await import('/src/renderer/src/stores/appStore.ts'))
     .useAppStore
   useAppStore.setState({ wizardEnabled: true })
   ```
   (Note: the actual `setState` shape depends on the final state-
   routing contract. The dev console will accept it via the
   defensive cast in `wizardFeatureFlag.ts`.)
2. **Add a temporary toggle in the Dashboard** (week 1 dev only —
   do not ship):
   ```tsx
   <button onClick={() => useAppStore.setState(s => ({
     ...s,
     wizardEnabled: !s.wizardEnabled,
   }))}>
     Toggle wizard
   </button>
   ```

## Screenshots (full screenshot pass is in week 8 beta test)

Per the brief, the full screenshot pass is in week 8. The week 1
ship is the wire-up + components + tests, not the visual evidence.

When the wizard is enabled in a dev build, the user should see:

1. **Product-type step (active)** — "What are you making?" card
   with 5 OptionTile rows, each with a `?` ProductTypeTooltip
   expander below.
2. **Method step (active)** — "Decarb method" card with 6
   OptionTile rows showing the temp / time / efficiency brief.
3. **Method step (collapsed-with-selection)** — green check + the
   chosen method's title, tap to re-edit.
4. **Name step (placeholder)** — disabled text input with
   placeholder "e.g., Morning dose — 28g, oven-sealed".
5. **ReferenceStrip** — Methods / Advanced / Knowledge / Journal
   cards render below the wizard, unchanged from the pre-wizard
   layout.

## Tests

39 new test cases across 6 new test files. All green at the
commit-point. See:

- `src/renderer/src/components/__tests__/Wizard.test.tsx`
  (6 cases: feature flag, branch sequences, callbacks)
- `src/renderer/src/components/__tests__/StepCard.test.tsx`
  (10 cases: 3 states × render + tap + Confirm)
- `src/renderer/src/components/__tests__/OptionTile.test.tsx`
  (9 cases: render, icon, badge, tap, selected state)
- `src/renderer/src/components/__tests__/ProductTypeTooltip.test.tsx`
  (5 cases: mount, collapse, expand, re-collapse)
- `src/renderer/src/wizard/__tests__/WizardScreen.test.tsx`
  (6 cases: feature flag, product-type routing, Flower Method
  advance, reset)
- `src/renderer/screens/__tests__/main.test.tsx`
  (2 cases: main wire-up — WizardScreen when on,
  GroupedTabNav when off)
