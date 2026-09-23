# QuasarOS Visualization Remediation 03: Operator Testing Guide

## 1. Quick Start
To launch the complete QuasarOS scientific ocean digital-twin locally:

```powershell
# In PowerShell from repository root:
.un_quasar.ps1
```

## 2. Service Endpoints
- **Frontend Web UI**: `http://127.0.0.1:5173`
- **Backend API**: `http://127.0.0.1:8000`
- **Readiness Probe**: `http://127.0.0.1:8000/health/ready`
- **API Documentation**: `http://127.0.0.1:8000/docs`

## 3. Recommended Operator Verification Steps
1. Open `http://127.0.0.1:5173` in a WebGPU-enabled browser (e.g. Google Chrome or Microsoft Edge).
2. Confirm the central viewport displays the 3D volumetric ocean temperature field with internal thermal gradients and bathymetric seafloor clipping.
3. Use the timeline controller at the bottom to scrub across the 7 available daily frames (2026-08-24 to 2026-08-30).
4. Toggle variables between Potential Temperature (`thetao`), Salinity (`so`), and Velocity (`uo`/`vo`).
5. Adjust transfer function colormaps (Viridis, Plasma, Turbo, Thermal) and clipping sliders.
6. Verify responsive layout by collapsing the left controls panel and right analysis panel.
