---
name: cannabis-team-conductor
description: Orchestration rules for the Cannabis Chemistry Calculator team. Loaded by the orchestrator (Mavis) on rotation / per-cycle decisions; tells me which rein to wake for which kind of ask, and how to launch the team plan from my own context so I don't punt dispatch back to the user.
---

# Cannabis Chemistry Calculator Team — Conductor Rules

This is the orchestrator-side doc. The reins (`chem-engine`, `ui-tabs`, `design-system`, `rich-features`, `state-routing`, `electron-shell`, `qa-e2e`) are mounted and executable. The orchestrator's job is to translate a user ask into a `mavis team plan run <yaml>` launched from MY bash, monitor it, and report back.

## Hard rule — dispatch is the orchestrator's job, not the user's

When the user asks for work on this repo, the orchestrator (Mavis / this session) must:

1. **Pick the lightest sufficient mechanism** for the ask:
   - **Direct execution in my own context** for trivial single-file edits, conversational answers, or "what does X look like in this repo" reads.
   - **Single `mavis communication send --to <rein-root-session-id> --command prompt --content "<self-contained task>"`** for one-off specialist calls where I want the answer back in MY context (e.g. "ask chem-engine what's the current cooling-curve constant for THCA decarb?").
   - **`mavis team plan run <yaml>` from my own bash** for anything that needs producer + verifier cycles, parallel tracks, or a closing gate.
   - **NEVER** punt by saying "run `mavis team plan run …` from your shell" — the user is the consumer of the result, not the dispatcher.

2. **Plan-id → user.** When launching a team plan from my context, output the plan_id + what each track is doing in one line, then keep going. Don't wait for the user to ask.

3. **Monitor via `mavis team plan status <id>` and `mavis session messages`** until terminal state. Surface cycle decisions inline. When the engine asks for an owner decision, write the decision JSON to a temp file and run `mavis team plan decision <plan_id> --file <path>` from my bash — never ask the user to do it.

## Routing table (ask → rein + plan skeleton)

| User asks for… | Mechanism | Reins woken |
|---|---|---|
| Read / explain a file or design | Direct execution in my context | none |
| One-off specialist question (engine constant, design system token, etc.) | `mavis communication send --to <rein-root>` | the named rein |
| Add / change a chemistry constant + tests | `mavis team plan run` (chem producer + qa-e2e verifier) | `chem-engine`, `qa-e2e` |
| Add / change a UI tab feature | `mavis team plan run` (ui producer + qa-e2e verifier) | `ui-tabs` (or `rich-features`), `qa-e2e` |
| Add / change a primitive / design token | `mavis team plan run` (design-system producer + qa-e2e verifier) | `design-system`, `qa-e2e` |
| Add / change store slice, TabId, persist migration, startup branch | `mavis team plan run` (state-routing + qa-e2e on first-launch) | `state-routing`, `qa-e2e` |
| Add / change Electron main, preload, packaging, release | `mavis team plan run` (electron-shell + qa-e2e smoke launch) | `electron-shell`, `qa-e2e` |
| Run an audit sweep on a tab | `mavis team plan run` single-task with `role: verify-as-task` | `qa-e2e` |
| Multi-component change (engine + UI + e2e in one go) | `mavis team plan run` fan-out, gates via `depends_on` | multiple producers + qa-e2e final gate |

## Agent-name double-mapping (read this once)

Each project rein has **two** names:

- **Short name** (e.g. `chem-engine`, `qa-e2e`) — global roster entry at `~/.mavis/agents/<name>/agent.md`. Use this when I want to pick the agent from `mavis agent list` or send a quick `mavis communication send --to <root-session>`.
- **Full prefixed name** (e.g. `c-users-lewis-ccc-cannabis-chemistry-calculator--chem-engine`) — the harness rein registered when I ran `mavis harness mount`. Use this when dispatching via `mavis team plan` YAML (the engine binds worker sessions to the project workspace).

Both point at the same system prompt (single source of truth in `.harness/reins/<name>/agent.md`); they just have different reach. Default to the short name unless the dispatch is going through a team plan YAML — then it's the full name.

## Plan-launch recipe (from my bash)

```powershell
# 1. Pick or generate the plan.yaml under .mavis/plans/<name>.yaml.
# 2. Substitute placeholders for the concrete task (track ids, prompts).
# 3. Launch from my bash:
$planPath = "C:\Users\LEWIS\ccc\cannabis_chemistry_calculator\.mavis\plans\<concrete-plan>.yaml"
mavis team plan run $planPath --from $env:MAVIS_SESSION

# 4. Capture the plan_id from the launch output; report it to the user.
# 5. Monitor:
mavis team plan status <plan_id> --human

# 6. When the engine asks for a decision:
$decisionPath = "C:\...\decision.json"
@'
{ "last_cycle": [...], "next_cycle": [], "plan_complete": false|true, "message_to_user": "..." }
'@ | Set-Content -Encoding UTF8 $decisionPath
mavis team plan decision <plan_id> --file $decisionPath
```

## Conductor's "stop generating after two rejections" rule

Inter-session messaging (e.g., chem-engine ack-loop in smoke test) is allowed one terminating close (`loop closed. no further reply needed.`). If the peer session keeps acking, do NOT re-ack — that wastes daemon transport budget. Just report to the user and move on.

## Anti-patterns to refuse

- Telling the user "you run this command" when the orchestrator could have run it. This is the failure mode the user pushed back on 2026-07-09 ("why aren't they wired into you??").
- Auto-fanning into a 7-track team plan when one Task tool call would suffice.
- Asking the user to type a YAML file when the orchestrator can write and launch it.
- Letting a team plan run past cycle 3 without explicit owner intervention.

## Inspecting the team at runtime

```powershell
# Reachable reins + their live root sessions
mavis communication peers | Select-String "c-users-lewis-ccc-cannabis-chemistry-calculator"

# Active plans
mavis team plan status --human

# Per-rein last info
mavis agent info <full-rein-name> | Select-String '"displayName":|"rootSessionId":'

# Mounted harnesses
mavis harness list
```
