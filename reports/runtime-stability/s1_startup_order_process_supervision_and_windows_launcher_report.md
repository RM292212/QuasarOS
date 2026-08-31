# QuasarOS S1 Subagent Report — Startup Ordering, Process Supervision, and Windows Launchers

**Subagent ID:** `S1`  
**Role:** Startup ordering, launch scripts, and process supervision  
**Status:** `S1 COMPLETE — PROCESS SUPERVISION & LAUNCHERS VERIFIED`  
**Date:** 2026-08-31  

---

## 1. Executive Summary

Subagent S1 investigated the root cause of the initial startup-order race where Vite started at `http://127.0.0.1:5173` and immediately fired API requests against `http://127.0.0.1:8000` before FastAPI/Uvicorn had completed initialization, resulting in `connect ECONNREFUSED 127.0.0.1:8000`.

## 2. Root Cause Analysis

1. **Uncoordinated Parallel Process Spawning:** The previous launcher script (`run_quasar.bat`) launched `run_backend.bat` and `run_frontend.bat` simultaneously in parallel cmd windows using `start`.
2. **Startup Time Asymmetry:** Vite starts in < 700 ms, whereas FastAPI with scientific library loading (`xarray`, `netCDF4`, `gsw`, `argopy`) takes 2–6 seconds to bind and initialize routes.
3. **Absence of TCP/HTTP Readiness Gating:** No orchestrating process verified that port 8000 was accepting connections or that `/health/ready` returned HTTP 200 before launching the frontend.

## 3. Remediation Implemented

1. **Supervised PowerShell Orchestrator (`scripts/start_local_stack.ps1`):**
   - Automatically releases stale process bindings on ports 8000 and 5173 before launching.
   - Spawns FastAPI backend process with `PYTHONPATH` correctly set to services and contracts.
   - Performs bounded polling on `http://127.0.0.1:8000/health/ready` with progressive backoff (1s to 3s).
   - Launches Vite frontend (`http://127.0.0.1:5173`) only after `/health/ready` probe succeeds.
2. **Dedicated Stack Stopper (`scripts/stop_local_stack.ps1`):**
   - Terminates backend and frontend processes cleanly, releasing sockets.
3. **Updated Root Launcher (`run_quasar.bat`):**
   - Directly executes `scripts/start_local_stack.ps1` to prevent uncoordinated execution.

## 4. Verification

- Verified backend readiness polling completes in ~3–5s on clean launch.
- Verified that ports 8000 and 5173 are freed upon executing `stop_local_stack.ps1`.
- Logged all launch actions to `reports/runtime-stability/evidence/logs/launcher.log`.
