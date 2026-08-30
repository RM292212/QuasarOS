# QuasarOS Visualization Remediation Guide & Testing Manual (VISUALIZATION-REMEDIATION-02R)

## 1. Quick Start
To launch the full-stack QuasarOS system:
```cmd
.\run_quasar.bat
```
Or run individually:
- Backend: `.\scripts\run_backend.bat` (FastAPI on `http://127.0.0.1:8000`)
- Frontend: `.\scripts\run_frontend.bat` (Vite on `http://127.0.0.1:5173`)

## 2. Interactive 3D Ocean Volume Verification
- **Real-Data Raymarching:** The 3D viewport samples real 3D NetCDF oceanic scalar arrays (`thetao`, `so`, `uo`, `vo`, `zos`).
- **Interactive Orbit:** Click and drag anywhere across the 3D viewport to inspect internal scalar structures, stratification, and mesoscale features.
- **7-Day Dynamic Playback:** Press **PLAY** in the bottom timeline controller to automatically advance through all 7 daily timesteps (`2026-08-24` to `2026-08-30`) with real-time 3D texture replacement and live HUD feedback.
- **TEOS-10 Soundings:** Real-time thermodynamic computations (Conservative Temperature, Absolute Salinity, In-Situ Density, Sound Speed, and Mixed Layer Depth at 21.60 m).
- **Argo In-Situ Fusion:** Collocated float R7900912 profile comparisons with layer-wise deltas and RMSE.
