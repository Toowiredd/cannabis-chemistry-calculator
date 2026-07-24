# Experience Topology Report: Cannabis Chemistry Calculator (ccc)

Overall status: **WARN**

## Coverage Summary

- Nodes: 21
- Edges: 25
- UI: 8
- UX: 3
- DX: 6
- AGENT: 4

## Topology Map

```mermaid
flowchart LR
  title["Cannabis Chemistry Calculator (ccc)"]
  decarb-tab["Decarb Calculator Tab (ui)"]
  infusion-tab["Infusion Calculator Tab (ui)"]
  dose-tab["Dose Calculator Tab (ui)"]
  methods-tab["Methods Comparison Tab (ui)"]
  advanced-tab["Advanced Tools Tab (Fats/Concentrate/Blend/Cost) (ui)"]
  journal-tab["Saved Batches Journal (ui)"]
  quickbatch-tab["Quick Batch 5-step Wizard (ui)"]
  first-timer-guide["First-Timer Guide Modal Wizard (ui)"]
  decide-batch-journey["Make a Batch Journey (Decarb → Infusion → Dose → Journal) (ux)"]
  first-time-journey["First-Time User Onboarding Journey (ux)"]
  unit-toggle-journey["Unit Conversion Toggle (g/oz, C/F, mL/tsp/tbsp/cup) (ux)"]
  engine-decarb["Decarb Engine (theoretical max, decarbed range) (dx)"]
  engine-infusion["Infusion Engine (infused THC, mg/mL, simplified estimate) (dx)"]
  engine-dosing["Dose Engine (mg/serving, classification) (dx)"]
  engine-units["Units Engine (C/F, g/oz, mL/tsp/tbsp/cup conversions) (dx)"]
  state-store["Zustand App Store (decarb, infusion, dose, units, journal, wizard) (dx)"]
  electron-ipc["Electron IPC Bridge (saveJournalEntry, loadJournalEntries, etc.) (dx)"]
  ccc-calc-auditor["Calc Auditor Agent (verifies engine math) (agent)"]
  ccc-workflow-validator["Workflow Validator Agent (verifies cross-tab handoffs) (agent)"]
  ccc-uiux-reviewer["UI/UX Reviewer Agent (a11y + reduced-motion) (agent)"]
  ccc-orchestrator["Validation Orchestrator (synthesizes audit results) (agent)"]
  decarb-tab -->|"User enters weight + THCA, sees theoretical max + decarb-adjusted range"| decide-batch-journey
  decide-batch-journey -->|"setLastDecarbExpected → useEffect auto-fills infusion.decarbedThc"| infusion-tab
  infusion-tab -->|"setLastInfusedThc → useEffect auto-fills dose.totalThc"| decide-batch-journey
  dose-tab -->|"Save to Journal — persists disk-first, then local store"| journal-tab
  first-timer-guide -->|"Wizard 'Save to Journal' from review step"| journal-tab
  quickbatch-tab -->|"Quick Batch 'Save Batch to Journal' button"| journal-tab
  decarb-tab -->|"DecarbTab useEffect calls calculateTheoreticalMax + calculateDecarbedThc"| engine-decarb
  infusion-tab -->|"InfusionTab useEffect calls calculateInfusedThc + calculateMgPerMl"| engine-infusion
  dose-tab -->|"DoseTab useEffect calls calculateMgPerServing + classifyDose"| engine-dosing
  decarb-tab -->|"DecarbTab reads/writes decarb slice via useAppStore"| state-store
  infusion-tab -->|"InfusionTab reads/writes infusion slice via useAppStore"| state-store
  dose-tab -->|"DoseTab reads/writes dose slice via useAppStore"| state-store
  journal-tab -->|"JournalTab reads/writes journalEntries slice via useAppStore"| state-store
  journal-tab -->|"loadJournalEntries on mount + saveJournalEntry/deleteJournalEntry on user action"| electron-ipc
  methods-tab -->|"handleUseThis: setDecarb({ presetId }) + setActiveTab('decarb') — picks a method and jumps to the calculator"| decarb-tab
  advanced-tab -->|"AdvancedToolsTab reads infusion/units slices for Fat Comparison sub-tab"| state-store
  ccc-orchestrator -->|"Orchestrator dispatches the 3 specialist agents in parallel"| ccc-calc-auditor
  ccc-orchestrator -->|"Orchestrator dispatches the 3 specialist agents in parallel"| ccc-workflow-validator
  ccc-orchestrator -->|"Orchestrator dispatches the 3 specialist agents in parallel"| ccc-uiux-reviewer
  ccc-calc-auditor -->|"Specialist reports back with severity-rated findings"| ccc-orchestrator
  ccc-workflow-validator -->|"Specialist reports back with severity-rated findings"| ccc-orchestrator
  ccc-uiux-reviewer -->|"Specialist reports back with severity-rated findings"| ccc-orchestrator
  ccc-orchestrator -->|"Orchestrator's remediation plan assigns fixes to the production code"| decide-batch-journey
  first-time-journey -->|"First-time user dismisses / completes wizard, lands on Decarb with prefilled values"| first-timer-guide
  unit-toggle-journey -->|"User toggles g/oz, C/F, mL/tsp/tbsp/cup — every tab reads units.* and re-derives display"| engine-units
```

## Verification Results

| Check | Status | Detail |
|---|---|---|
| Layer Presence | PASS | All layers present. |
| Edge Reference Integrity | PASS | All edges reference known nodes. |
| Node Connectivity | PASS | No isolated nodes. |
| Data Contract Completeness | PASS | All edges define data contracts. |
| Node Evidence Completeness | PASS | All nodes include evidence. |
| Node Evidence Typing | PASS | All nodes use evidence_type in {test, telemetry, artifact}. |
| Critical Node Executable Evidence | PASS | All critical nodes use executable evidence_type. |
| High Risk Handoffs | WARN | High risk edges: dose-tab->journal-tab, first-timer-guide->journal-tab, quickbatch-tab->journal-tab, journal-tab->electron-ipc |
| High-Risk Critical Human Override | PASS | All critical/high-risk edges define human_override=true. |
| Critical Edge Failure Ownership | PASS | All critical-impact edges define fallback_path and owner_on_failure. |
| AI Handoff Contract Completeness | PASS | All declared AI handoffs include planner_output_contract, execution_guard_result, and verification_result. |
| Critical Edge Resilience Controls | PASS | All critical-impact edges define retry_policy, rollback_strategy, and degraded_mode. |

## Risk Register

- WARN: High Risk Handoffs -> High risk edges: dose-tab->journal-tab, first-timer-guide->journal-tab, quickbatch-tab->journal-tab, journal-tab->electron-ipc

## Suggested Actions

- Track follow-up for `High Risk Handoffs` before production.