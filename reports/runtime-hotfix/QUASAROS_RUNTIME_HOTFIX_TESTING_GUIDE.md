# QuasarOS Runtime Hotfix Testing Guide

## Quick Start

### Launch Backend
```cmd
set PYTHONPATH=packages/services/src;packages/contracts/src
python -m uvicorn quasar_services.app:app --host 127.0.0.1 --port 8000 --log-level info
```
Wait ~10 seconds for argopy to initialise.

### Launch Frontend
```cmd
cd apps/web
npx vite --host 127.0.0.1 --port 5173
```

### Open in Browser
Navigate to: http://127.0.0.1:5173

---

## Health Verification URLs

| Endpoint | Expected |
|----------|----------|
| http://127.0.0.1:8000/health/live | `{"status":"ok",...}` |
| http://127.0.0.1:8000/health/ready | `{"status":"ok",...}` (HTTP 200 = data readable) |
| http://127.0.0.1:8000/api/v1/docs | Interactive API documentation |

---

## RUNTIME-HOTFIX-03 Verification

### 1. Volume-Grid Stability (NETCDF FIX)
Run the previously-failing request twice in succession:
```
GET http://127.0.0.1:8000/api/v1/analysis/volume-grid?variable=thetao&time_index=6&depth_levels=16&lat_res=32&lon_res=32
```
**Expected:** Both return `200 OK` with shape `[16,32,32]`. The error `NetCDF: Not a valid ID` must NOT appear.

### 2. Input Validation (400 expected)
```
GET http://127.0.0.1:8000/api/v1/analysis/volume-grid?variable=INVALID&time_index=0
```
**Expected:** `400` with `{"error":{"code":"VALIDATION_ERROR",...}}`

### 3. TEOS-10 Soundings (200 expected)
```
POST http://127.0.0.1:8000/api/v1/analysis/teos10-soundings
Content-Type: application/json
{"latitude": 6.0, "longitude": 84.0, "time_index": 0}
```
**Expected:** `200` with MLD value and 31 soundings.

### 4. 7-Day Playback
- Open http://127.0.0.1:5173
- Click PLAY or use day selector
- Each day (2026-08-24 to 2026-08-30) should load a distinct scalar field with no 500 errors in the browser console or network tab.

### 5. TEOS-10 Panel Behaviour
- On first load: panel should NOT fire a 400 request. It shows the computation for the default valid point (6.0°N, 84.0°E).
- If coordinates outside domain are entered: a validation message appears without submitting a request.

---

## Architecture Note (HOTFIX-03)

**Root cause fixed:** The analysis engine previously cached `xr.Dataset` objects across requests in a shared singleton, allowing threads to call `.values` on lazy `DataArray` objects after the underlying NetCDF4 handle was closed.

**Fix applied:** Strategy A — every request opens the file, materialises the required subset into a NumPy array, then closes the file. No shared state. Thread-safe by construction.
