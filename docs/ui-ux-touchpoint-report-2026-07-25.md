# Experience Topology Report: Cannabis Chemistry Calculator UI/UX Touchpoint Topology (post PWA + inventory + per-field units)

Overall status: **WARN**

## Coverage Summary

- Nodes: 29
- Edges: 49
- UI: 18
- UX: 2
- DX: 8
- AGENT: 1

## Topology Map

```mermaid
flowchart LR
  title["Cannabis Chemistry Calculator UI/UX Touchpoint Topology (post PWA + inventory + per-field units)"]
  ui_loading_overlay["Launch Loading Overlay (ui)"]
  agent_startup_heuristic["Startup Routing Heuristic (agent)"]
  ui_startup_chooser["Startup Intent Chooser (ui)"]
  ui_first_timer_guide["First-Timer Guide Modal (ui)"]
  ui_nav_shell["Top Navigation Shell (ui)"]
  ux_guided_batch["Guided Batch Journey (ux)"]
  ui_quick_batch["Quick Batch Wizard (ui)"]
  ui_workflow_deck["Decarb Infusion Dose Swipe Deck (ui)"]
  ui_decarb["Decarb Calculator (ui)"]
  ui_infusion["Infusion Calculator (ui)"]
  ui_dose["Dose Calculator (ui)"]
  ui_methods["Methods Comparison (ui)"]
  ui_advanced_tools["Advanced Tools (ui)"]
  ui_journal["Journal (ui)"]
  ui_dashboard["Dashboard (ui)"]
  ui_inventory_section["Inventory Section (Dashboard) (ui)"]
  ux_insufficient_material_gate["Insufficient Material Gate (3-case warning) (ux)"]
  ui_knowledge["Knowledge (ui)"]
  ui_actions_export_copy["Copy and Export Actions (ui)"]
  ui_timer["Timer Widget (ui)"]
  ui_pwa_install["PWA Install Surface (iPad) (ui)"]
  dx_store_contract["Zustand Store Contract (incl. v1 to v2 migration) (dx)"]
  dx_per_field_units["Per-Field Unit Tracking (weight, volume, temp, bag dims) (dx)"]
  dx_journal_source_provenance["JournalEntry Source Provenance (v1 to v2 migration) (dx)"]
  dx_ipc_contract["Electron IPC Bridge Contract (dx)"]
  dx_pwa_shim["PWA Web Shim (window.App on browser) (dx)"]
  dx_pwa_host["PWA Host (Tailscale Funnel + static server) (dx)"]
  dx_pwa_validator["PWA Pre-Flight Validator (20 checks) (dx)"]
  dx_test_contract["Regression Test Coverage (1004 tests, 54 files) (dx)"]
  ui_loading_overlay -->|"App launch triggers startup routing evaluation"| agent_startup_heuristic
  agent_startup_heuristic -->|"Low or medium confidence opens chooser"| ui_startup_chooser
  agent_startup_heuristic -->|"High confidence routes directly to destination tab"| ui_nav_shell
  ui_nav_shell -->|"First-Timer Guide button or first-run state opens modal"| ui_first_timer_guide
  ui_first_timer_guide -->|"Open in Quick Batch pre-fills slices and switches tab"| ui_quick_batch
  ui_startup_chooser -->|"Make a batch intent"| ui_quick_batch
  ui_startup_chooser -->|"History / learn intent"| ui_journal
  ui_startup_chooser -->|"Resume or repeat intent"| ui_workflow_deck
  ui_nav_shell -->|"Quick Batch tab click"| ui_quick_batch
  ui_nav_shell -->|"Decarb Infusion Dose tab click"| ui_workflow_deck
  ui_workflow_deck -->|"Workflow deck shows decarb panel"| ui_decarb
  ui_workflow_deck -->|"Workflow deck shows infusion panel"| ui_infusion
  ui_workflow_deck -->|"Workflow deck shows dose panel"| ui_dose
  ui_quick_batch -->|"Wizard stepper moves through material, method, fat, dose, label"| ux_guided_batch
  ux_guided_batch -->|"Save Batch to Journal with source=quickbatch"| ui_journal
  ui_nav_shell -->|"Methods tab click"| ui_methods
  ui_methods -->|"Use This method applies selected decarb settings"| ui_decarb
  ui_nav_shell -->|"Advanced Tools tab click"| ui_advanced_tools
  ui_advanced_tools -->|"Concentrates Use This applies concentrate data and weightUnit"| ui_decarb
  ui_advanced_tools -->|"Fat Comparison Use This applies fat and volumeUnit"| ui_infusion
  ui_nav_shell -->|"Dashboard tab click"| ui_dashboard
  ui_dashboard -->|"Dashboard hosts InventorySection as a child surface"| ui_inventory_section
  ui_inventory_section -->|"addInventoryItem / deleteInventoryItem / updateInventoryItem persist to Zustand"| dx_store_contract
  ui_inventory_section -->|"Material on Hand sum feeds the 3-case gate on Decarb/QuickBatch"| ux_insufficient_material_gate
  ui_decarb -->|"Decarb weight vs inventory triggers warning or CTA"| ux_insufficient_material_gate
  ui_quick_batch -->|"QuickBatch grams vs inventory triggers warning or CTA"| ux_insufficient_material_gate
  ux_insufficient_material_gate -->|"Add to your inventory CTA jumps user to Dashboard tab"| ui_dashboard
  ui_nav_shell -->|"Knowledge tab click"| ui_knowledge
  ui_knowledge -->|"Apply to Decarb writes tempOverride + tempOverrideUnit"| ui_decarb
  ui_decarb -->|"Start method timer"| ui_timer
  ui_journal -->|"Load save delete journal entries"| dx_ipc_contract
  ui_journal -->|"Journal form save stamps source=journal_form on entry"| dx_journal_source_provenance
  ui_first_timer_guide -->|"First-Timer Guide save stamps source=first_timer_guide"| dx_journal_source_provenance
  ui_actions_export_copy -->|"Copy or export active report (Electron native save dialog + clipboard)"| dx_ipc_contract
  ui_actions_export_copy -->|"PWA build routes clipboard + export download through the web shim"| dx_pwa_shim
  ui_nav_shell -->|"Tab surfaces expose copy and export actions"| ui_actions_export_copy
  ui_nav_shell -->|"All visible tab changes and calculator edits update store"| dx_store_contract
  ui_decarb -->|"Decarb weight and temp overrides carry their input unit (weightUnit, tempOverrideUnit)"| dx_per_field_units
  ui_quick_batch -->|"QuickBatch material/fat slices persist per-field units"| dx_per_field_units
  ui_infusion -->|"Infusion volume input uses infusion.volumeUnit (per-field)"| dx_per_field_units
  ui_knowledge -->|"Doneness curve slider tracks value in display unit, writes tempOverrideUnit on apply"| dx_per_field_units
  dx_per_field_units -->|"Per-field unit fields are partialize'd in Zustand persist"| dx_store_contract
  dx_journal_source_provenance -->|"v1 to v2 migration in appStore stamps source=unknown on legacy entries"| dx_store_contract
  ui_pwa_install -->|"PWA build swaps window.App implementation to the web shim"| dx_pwa_shim
  ui_pwa_install -->|"PWA served via Tailscale Funnel from the static server on 127.0.0.1:8765"| dx_pwa_host
  dx_pwa_host -->|"Pre-flight validator runs 20 checks before declaring PWA ready"| dx_pwa_validator
  dx_pwa_shim -->|"Web shim persists to browser localStorage with the same shape as Electron localStorage"| dx_store_contract
  dx_store_contract -->|"Store and UI contracts are covered by focused tests (1004 tests, 54 files)"| dx_test_contract
  dx_ipc_contract -->|"IPC-facing helpers validated through export and shim tests"| dx_test_contract
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
| High Risk Handoffs | WARN | High risk edges: ui_loading_overlay->agent_startup_heuristic, ux_guided_batch->ui_journal, ui_journal->dx_ipc_contract |
| High-Risk Critical Human Override | PASS | All critical/high-risk edges define human_override=true. |
| Critical Edge Failure Ownership | PASS | All critical-impact edges define fallback_path and owner_on_failure. |
| AI Handoff Contract Completeness | PASS | All declared AI handoffs include planner_output_contract, execution_guard_result, and verification_result. |
| Critical Edge Resilience Controls | PASS | All critical-impact edges define retry_policy, rollback_strategy, and degraded_mode. |

## Risk Register

- WARN: High Risk Handoffs -> High risk edges: ui_loading_overlay->agent_startup_heuristic, ux_guided_batch->ui_journal, ui_journal->dx_ipc_contract

## Suggested Actions

- Track follow-up for `High Risk Handoffs` before production.