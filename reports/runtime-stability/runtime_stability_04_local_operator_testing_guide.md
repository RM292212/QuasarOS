# QuasarOS RUNTIME-STABILITY-04 — Local Operator Testing Guide

This guide provides step-by-step instructions for launching, interacting with, and verifying the QuasarOS full-stack scientific oceanography application.

---

## 1. Quick Launch (Recommended)

From PowerShell or Command Prompt in the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start_local_stack.ps1
```

Or double-click `run_quasar.bat`.

### What the Launcher Does:
1. Automatically detects and frees any stale processes on ports 8000 and 5173.
2. Spawns the FastAPI backend server in a dedicated interactive window.
3. Performs active TCP/HTTP readiness checks against `http://127.0.0.1:8000/health/ready`.
4. Spawns the Vite frontend in a second dedicated window **only after** backend readiness is certified.

---

## 2. Service Endpoints

Once launched, navigate to:

- **Frontend Web Application:** [http://127.0.0.1:5173](http://127.0.0.1:5173)
- **FastAPI Backend Server:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger / OpenAPI Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Service Liveness Probe:** [http://127.0.0.1:8000/health/live](http://127.0.0.1:8000/health/live)
- **Service Readiness Probe:** [http://127.0.0.1:8000/health/ready](http://127.0.0.1:8000/health/ready)

---

## 3. Interactive Verification Steps

### A. 3D Ocean Volume Rendering & Orbit Controls
1. Open [http://127.0.0.1:5173](http://127.0.0.1:5173).
2. Observe the WebGL2/WebGPU 3D ocean volume rendered in the central viewport.
3. Click and drag with your mouse to rotate and inspect the 3D thermal/oceanic scalar field.

### B. 7-Day Timeline Playback
1. Click the **PLAY** button in the timeline bar at the bottom, or click on individual days (Day 1 through Day 7).
2. Verify that the 3D volume smoothly streams and displays distinct authoritative Copernicus data for each day (2026-08-24 to 2026-08-30).
3. Confirm that rapid scrubbing does not cause errors or freeze the UI (stale requests are cancelled cleanly).

### C. Multivariable Dataset Navigation
1. In the top navigation bar, switch between available physical variables:
   - `thetao` (Potential Temperature, °C)
   - `so` (Salinity, 1e-3)
   - `uo` (Eastward Velocity, m/s)
   - `vo` (Northward Velocity, m/s)
   - `zos` (Sea Surface Height Above Geoid, m)
2. Observe that the colorbars, observed value ranges, and 3D scalar fields update immediately.

### D. TEOS-10 Soundings & Argo Observation Collocation
1. Inspect the TEOS-10 derived oceanography panel.
2. Confirm the calculation of Absolute Salinity, Conservative Temperature, In-Situ Density, Sound Speed, and Mixed Layer Depth (MLD).
3. View the in-situ Argo float comparison table (Platform 5906421) displaying collocated temperature deltas and RMSE metrics.

---

## 4. Stopping the Application

To shut down both backend and frontend servers cleanly and release all network ports:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\stop_local_stack.ps1
```
