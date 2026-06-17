# Startup Routing Master Doc

## Purpose

This document is the master product and implementation reference for app startup
routing in Cannabis Chemistry Calculator.

It exists because the current startup path is a static tab default, while the
product actually serves multiple different human intents:

1. make a batch
2. resume or repeat prior work
3. review history or learn

A single hardcoded launch tab cannot handle those intents well.

## Current State

### What the app does today

- The persisted store boots with `activeTab: 'decarb'`.
- `MainScreen` opens the `First-Timer Guide` on first run.
- After first run, the app returns to the regular shell with the static tab
  default still underneath.

### Why this is a problem

`Decarb` is a strong expert calculator surface, but it is the wrong startup
surface for default human intent.

Problems with a `decarb` default:

- it starts in the middle of the batch-making journey
- it assumes the user already understands the pipeline
- it favors expert mode over guided mode
- it ignores repeat-user intents like resume, repeat, or review

## Recommended Solution

Use a two-stage startup system:

1. a tiny startup chooser for ambiguous or early use
2. a persisted last-successful-path heuristic for confident repeat use

This is the most appropriate solution because it handles both novice ambiguity
and repeat-user efficiency.

## Startup Decision Tree

### Phase 1: First Run

If `firstRunDismissed === false`:

- show `First-Timer Guide`
- set `Quick Batch` as the underlying path

Rationale:

- the guide teaches the human sequence correctly
- `Quick Batch` mirrors the same sequence in operational form

### Phase 2: Ambiguous Return

If the user is no longer first-run, but the app does not yet have a reliable
startup prediction:

- show a tiny chooser with 2-3 intents

Recommended chooser intents:

1. `Make a batch`
   Destination: `Quick Batch`

2. `Resume or repeat`
   Destination: last meaningful workflow target or last saved batch path

3. `History / learn`
   Destination: `Journal`

Optional secondary links from `History / learn`:

- `Knowledge`
- `Dashboard`

### Phase 3: Confident Return

If the app has enough evidence about where the user actually succeeds:

- skip the chooser
- auto-route to the last successful path

## What Counts As A Successful Path

Do not use `activeTab` alone.

Use higher-signal outcomes instead.

### Good signals

- saved a batch from `Quick Batch`
- logged or saved to `Journal`
- resumed a prior batch intentionally
- repeated a previous batch intentionally
- reached a complete dose result after meaningful upstream input
- repeatedly launched from the same chooser intent

### Weak or bad signals

- last tab clicked
- accidental nav visits
- one-off curiosity visits to reference tabs
- stale partial form state by itself

## Heuristic Design

The heuristic should produce:

- `predicted_start_mode`
- `confidence`
- `source_signals`

### Suggested start modes

- `make_batch`
- `resume_repeat`
- `history_learn`
- `manual_calculator`

### Suggested routing

- `make_batch` -> `Quick Batch`
- `resume_repeat` -> resume target or last saved batch
- `history_learn` -> `Journal`
- `manual_calculator` -> most relevant raw workflow tab

### Confidence guidance

- low confidence -> show chooser
- medium confidence -> chooser with one recommended option highlighted
- high confidence -> route directly

## Information Architecture Guidance

The app currently contains three different product modes:

1. guided batch creation
2. raw workflow calculators
3. reference/history utilities

Those should be treated as explicit human intents.

Recommended grouping:

### Make

- Quick Batch
- Decarb
- Infusion
- Dose

### Optimize

- Methods
- Advanced Tools

### Reference

- Journal
- Knowledge
- Dashboard

This does not require a full nav redesign immediately, but startup routing
should already respect these groups.

## Why Quick Batch Is The Best Static Fallback

If the app must keep a single startup destination while the chooser and
heuristic are still being built, use `Quick Batch`.

Why:

- it reflects the full user journey
- it is easier to understand than `Decarb`
- it supports repeat behavior like `Start from last batch`
- it ends in saveable output

`Quick Batch` is not the final solution. It is the best static fallback.

## Implementation Sequence

### Step 1

Ship the tiny chooser.

This gives the product a correct startup model immediately, even before any
heuristic exists.

### Step 2

Persist explicit routing signals, not just tabs.

Examples:

- last chooser intent
- last successful path
- resume target
- success counters by mode
- confidence score

### Step 3

Add startup auto-routing when confidence is high.

### Step 4

Optionally regroup nav and IA labels to match the startup model.

## Persistence Guidance

The current store intentionally does not persist `activeTab`.

That is correct for now.

When startup routing is expanded, persist:

- chooser intent
- last successful path
- resume metadata
- confidence metadata

Do not persist:

- raw tab clicks as the sole routing source

## UX Guardrails

- Always provide a `Change start mode` or equivalent escape hatch.
- Never trap the user in a heuristic they did not explicitly choose.
- Do not show more than 3 startup chooser options.
- Do not treat history/reference visits as equivalent to productive paths.
- Keep first-run education separate from repeat-user routing.

## Final Recommendation

Replace the hardcoded startup tab model with:

1. `First-Timer Guide` for first launch
2. tiny chooser for ambiguous return states
3. persisted last-successful-path auto-routing for confident repeat use

If only one short-term change is possible, make `Quick Batch` the fallback
default until the chooser exists.

## Implemented State

As of 2026-06-17, the project now implements the intended startup model:

1. first run routes the underlying shell to `Quick Batch`
2. first run opens `First-Timer Guide` above that path
3. ambiguous return states open the tiny chooser
4. the chooser defaults the underlying shell to its recommended destination
5. repeat users with strong history auto-route without seeing the chooser
6. the nav now exposes a manual `Choose Start` escape hatch

### Recorded signals now in use

- `Quick Batch` save -> `make_batch`
- `Quick Batch` load last batch -> `resume_repeat`
- `Journal` save -> `history_learn`
- completed `Dose` result -> `manual_calculator`

### Important guardrail

Startup routing only intercepts the bootstrap default state.

If another tab is already active, the shell treats that as explicit state and
does not override it during startup evaluation. This avoids breaking legitimate
deep links, tests, and manual in-session navigation.

## UI Completion Guardrails

As of 2026-06-18, the whole-app UI pass also locks in these behavior rules:

- `Escape` is non-destructive on calculator tabs. It may dismiss transient UI,
  but it must not reset Decarb, Infusion, or Dose state.
- Journal deletion is a two-step in-card confirmation before persisted storage
  is changed.
- Quick Batch step navigation uses destination-aware labels and
  `aria-current="step"` for the active step.
- Icon-only controls require an `aria-label` or visible text.
- Narrow panes must not create body or main horizontal overflow.
- Tooltips use the shared `TooltipIcon` pattern where practical so hover,
  focus, and Escape behavior stay consistent.
