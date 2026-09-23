# Subagent Registry & Responsibility Matrix

**Document ID**: REG-SUBAGENT-VR03-01  
**Milestone**: VISUALIZATION-REMEDIATION-03  
**Date**: 2026-08-31T15:15:00Z  
**Governing Standard**: QuasarOS Multi-Agent Lifecycle Governance  

---

## 1. Overview & Operational Protocol

This registry records all active and scheduled subagents participating in the **VISUALIZATION-REMEDIATION-03** milestone. Each agent possesses a defined archetype, role scope, isolated `.agents/<agent_name>/` working directory, and clear operational boundaries.

---

## 2. Master Subagent Registry

| Agent ID | Archetype | Working Directory | Primary Responsibility Scope | Target Milestone Wave | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`orchestrator_1`** | Orchestrator | `.agents/orchestrator_1/` | Multi-agent coordination, phase gating, final release sign-off | Wave V0–VR8 | **ACTIVE** |
| **`spec_miner_paper`** | Specialist | `.agents/spec_miner_paper/` | Research paper mining & mathematical spec generation | Wave V0 | **COMPLETED** |
| **`explorer_backend`** | Implementer | `.agents/explorer_backend/` | Backend architecture, Copernicus NetCDF assets, API routes | Wave V0 | **COMPLETED** |
| **`explorer_frontend`** | Implementer | `.agents/explorer_frontend/` | React SPA architecture, viewport review, timeline investigation | Wave V0 | **COMPLETED** |
| **`worker_wave_v0_vr1`** | Implementer/QA | `.agents/worker_wave_v0_vr1/` | Forensic baseline, hypothesis matrix H1-H10, 7-day logs, baseline report | Wave V0 & VR1 | **IN PROGRESS** |
| **`worker_wave_vr2`** | Implementer | `.agents/worker_wave_vr2/` | Backend data integrity, coordinate synchronization, NetCDF lifecycle | Wave VR2 | **PENDING** |
| **`worker_wave_vr3`** | Implementer | `.agents/worker_wave_vr3/` | WebGPU/WebGL2 raymarching rebuild, ERT 0.98, empty space skipping 1.5x | Wave VR3 | **PENDING** |
| **`worker_wave_vr4`** | Implementer | `.agents/worker_wave_vr4/` | GEBCO 2026 bathymetry seafloor mesh, seabed clipping, axes gizmo | Wave VR4 | **PENDING** |
| **`worker_wave_vr5`** | Implementer | `.agents/worker_wave_vr5/` | 7-day timeline playback FSM, double-buffering, live API hook wiring | Wave VR5 | **PENDING** |
| **`worker_wave_vr6`** | Implementer | `.agents/worker_wave_vr6/` | Production UI/UX layout, tabbed sidebar, zero panel collision, WCAG AA | Wave VR6 | **PENDING** |
| **`worker_wave_vr7_vr8`**| Implementer/QA | `.agents/worker_wave_vr7_vr8/`| Performance benchmarks, test suite greening, SHA-256 evidence | Wave VR7 & VR8 | **PENDING** |
| **`teamwork_preview_auditor`**| Auditor | `.agents/sentinel/` | Independent forensic audit, anti-cheating validation, release gate | Wave VR8 | **ACTIVE** |

---

## 3. Communication and Handoff Invariants

1. **Self-Contained Handoffs**: Every subagent writes a structured `handoff.md` containing Observation, Logic Chain, Caveats, Conclusion, and Verification Method before transitioning turn.
2. **Metadata Isolation**: Agents write exclusively to their own `.agents/<agent_name>/` folder and `reports/visualization-remediation-03/`. No source or test code is placed in `.agents/`.
3. **Integrity Mandate**: No hardcoded test outputs, synthetic mock formulas in production code, or shortcut validations. Real state and empirical proof are required for all deliverables.
