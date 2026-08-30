# QuasarOS Local Testing Guide

## 1. Local Runtime Summary
- **Frontend URL:** http://127.0.0.1:5173
- **Backend URL:** http://127.0.0.1:8000
- **API Documentation:** http://127.0.0.1:8000/docs
- **Health Probes:**
  - Liveness: http://127.0.0.1:8000/health/live
  - Readiness: http://127.0.0.1:8000/health/ready

## 2. Process Control
- **Backend Logs:** `reports/program-closeout/evidence/runtime/backend.log`
- **Frontend Logs:** `reports/program-closeout/evidence/runtime/frontend.log`
- **Stop Services:** Run `Stop-Process -Id 5944, '$frontendProcess.Id'`
- **Restart Services:** Run `powershell -ExecutionPolicy Bypass -File scripts/start_local_stack.ps1`

## 3. Interactive Workflows to Test
1. **Multivariable 3D Volume:** Switch variables among `thetao`, `so`, `uo`, `vo`, and `zos`.
2. **Analysis Panels:** Use the Transect tool, Depth Slice slider, T-S Diagram, and TEOS-10 Soundings.
3. **Observations:** Open the Observation Comparison Panel to compare the 3-profile Arabian Sea Argo ensemble against model predictions.
