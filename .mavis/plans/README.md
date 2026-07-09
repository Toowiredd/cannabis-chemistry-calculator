# Cannabis Chemistry Calculator — Mavis Team Quick Reference

The seven reins registered for this project (`mavis agent list --project "C:\Users\LEWIS\ccc\cannabis_chemistry_calculator"`) are dispatchable via `mavis team plan`. Each plan is a YAML file in this directory; the engine fans it out to producers + verifiers, monitors, and submits a decision cycle back to the orchestrator.

## Reins (exact full names — copy/paste into `assigned_to` / `verified_by`)

Each project rein has two registered names. Use the **full prefixed name** when the dispatch goes through a `mavis team plan` YAML (the engine binds sessions to the project workspace). Use the **short name** when I want to delegate directly from my own context via `mavis communication send`, `Task tool`, or `mavis agent list`.

| Short name (roster) | Full name for plan.yaml |
|---|---|
| `chem-engine` | `c-users-lewis-ccc-cannabis-chemistry-calculator--chem-engine` |
| `ui-tabs` | `c-users-lewis-ccc-cannabis-chemistry-calculator--ui-tabs` |
| `design-system` | `c-users-lewis-ccc-cannabis-chemistry-calculator--design-system` |
| `rich-features` | `c-users-lewis-ccc-cannabis-chemistry-calculator--rich-features` |
| `state-routing` | `c-users-lewis-ccc-cannabis-chemistry-calculator--state-routing` |
| `electron-shell` | `c-users-lewis-ccc-cannabis-chemistry-calculator--electron-shell` |
| `qa-e2e` | `c-users-lewis-ccc-cannabis-chemistry-calculator--qa-e2e` |

External verifiers (global, available to every plan):

- `qa-e2e` reins as the project's primary verifier — every UI/visible-area change should pass through it.
- `tester` for tests-only verdicts when chem-engine / state-routing produce headless work.

## Common commands

```powershell
# List active plans
mavis team plan status --human

# Launch a plan from this dir
mavis team plan run ".mavis\plans\example-add-decarb-preset.yaml"

# Pause / resume
mavis team plan pause <plan_id>
mavis team plan resume <plan_id>

# Steer a running task (abort + new prompt)
mavis team plan steer <plan_id> --message "<correction>"

# Unblock a task that the dep graph wrongly blocked
mavis team plan unblock <plan_id> <task-id>

# Extend a producer's timeout (up to 30-min cap)
mavis team plan extend-timeout <plan_id> <task-id> --minutes 10

# Submit an owner decision (Accept / Reject / manual_retry / override_accept)
mavis team plan decision <plan_id> --file ".mavis\plans\decision.json"

# Cancel
mavis team plan cancel <plan_id>
```

## Decision JSON shape

The decision engine is strict. Every `last_cycle` entry needs `reason`; top-level needs `next_cycle: []` and `plan_complete: true|false`. Templates in `mavis-team-engine.md` (orchestrator memory topic) §"Owner decision JSON schema".

```json
{
  "last_cycle": [
    { "task_id": "chem-engine-add-preset", "verdict": "accept", "reason": "Vitest green, typecheck clean, preset added with citation." }
  ],
  "next_cycle": [],
  "plan_complete": true,
  "message_to_user": "Decarb preset shipped end-to-end."
}
```

## Files in this directory

| File | Purpose |
|---|---|
| `README.md` | This quick reference |
| `template.yaml` | Copy + fill plan with placeholders `<...>` for new tasks |
| `example-add-decarb-preset.yaml` | Concrete working plan: end-to-end add a new decarb preset |
| `example-run-e2e-audit.yaml` | Concrete working plan: run qa-e2e audit on a tab |
| `decision.example.json` | Sample decision payload for `mavis team plan decision --file` |

## Routing cheat-sheet (which rein for which change)

| If you're changing… | Assign to | Why |
|---|---|---|
| A formula in `engine/*.ts` | `chem-engine` | Pure-TS invariant |
| A `TabId`, persist slice, or startup branch | `state-routing` | Touches `appStore.ts` |
| A tab page in `src/renderer/src/tabs/*.tsx` | `ui-tabs` | Per-tab flow |
| A custom widget (`DecarbHeatmap`, `MolecularBuilder`, etc.) | `rich-features` | Heavy single-purpose widget |
| A shadcn-style primitive or token | `design-system` | Cross-cutting primitive |
| `src/main/`, `src/preload/`, packaging, release | `electron-shell` | Native + build |
| Per-interaction test matrix / audit report | `qa-e2e` | Auditing; routes fixes to other reins |

## Verifier roles

| Task | Verifier |
|---|---|
| `chem-engine` produces | `qa-e2e` for behavioral diff (or `tester` for unit-test-only checks) |
| `ui-tabs` / `design-system` / `rich-features` produces | `qa-e2e` (Playwright MCP audit pattern) |
| `state-routing` produces | `chem-engine` (for store logic) OR `qa-e2e` (for first-launch UX) |
| `electron-shell` produces | `qa-e2e` (smoke launch of packaged binary) |
| `qa-e2e` produces | none — qa-e2e is itself the verifier; or another fresh-context `qa-e2e` session for double-blind |

## Anti-fabrication contract (binding on all reins)

No invented constants, brand names, citations, or UI touchpoints — see `.harness/agent.md` §"Anti-fabrication contract". The contract also lives in the orchestrator-side memory topic for reference.
