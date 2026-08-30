# Argo GDAC Data Source Specification

**File:** `docs/03-science-data/sources/ArgoGDAC.md`  
**Status:** Normative  
**Subsystem:** Scientific Data Ingestion & Observation Model (`TASK-01G`)

## 1. Overview

The Argo Global Data Assembly Centre (Argo GDAC) provides the authoritative global repository of real-time and delayed-mode in-situ oceanographic profile and trajectory observations collected by the international Argo float array.

For QuasarOS and QuasarOceanScope, Argo GDAC serves as the primary real-world in-situ observation ground truth for:
- 3D/4D vertical profile visualization in the Scientific Volume Lab.
- Model-versus-observation collocation, residual calculation, and statistical validation (bias, RMSE).
- Climatological anomaly validation against WOA23.
- Biogeochemical (BGC) optical and biogeochemical parameter evaluation (DOXY, CHLA, BBP700, CDOM, PAR).

## 2. Endpoints and Index Services

Official GDAC mirror nodes:
- **IFREMER (France):** `https://data-argo.ifremer.fr/` / `ftp://ftp.ifremer.fr/ifremer/argo/dac/`
- **US GODAE (USA):** `https://usgodae.org/pub/outgoing/argo/dac/` / `ftp://usgodae.org/pub/outgoing/argo/dac/`

Authoritative index files:
- Core physical profiles: `https://data-argo.ifremer.fr/ar_index_global_prof.txt`
- Synthetic BGC profiles: `https://data-argo.ifremer.fr/argo_synthetic-profile_index.txt`
- Bio-profile index: `https://data-argo.ifremer.fr/argo_bio-profile_index.txt`
- Trajectory index: `https://data-argo.ifremer.fr/ar_index_global_traj.txt`

Data access root:
```text
https://data-argo.ifremer.fr/dac/<DAC_NAME>/<PLATFORM_NUMBER>/profiles/<PROFILE_FILE>.nc
```

## 3. Supported Profile Types

QuasarOceanScope ingests and supports:
1. **Core Argo Profiles (`D*.nc`, `R*.nc`):**
   - Delayed mode (`D`) and Real-time mode (`R`).
   - Essential physical parameters: Pressure (`PRES`), Temperature (`TEMP`), Practical Salinity (`PSAL`).
   - Adjusted values: `PRES_ADJUSTED`, `TEMP_ADJUSTED`, `PSAL_ADJUSTED`.
2. **Synthetic BGC Profiles (`SD*.nc`, `SR*.nc`):**
   - Multi-parameter unified vertical sampling profiles merging CTD and biogeochemical sensors.
   - Core + BGC variables: Dissolved Oxygen (`DOXY`), Chlorophyll-a (`CHLA`), Particulate Backscattering (`BBP700`), Chromophoric Dissolved Organic Matter (`CDOM`), Downwelling Irradiance (`DOWN_IRRADIANCE*`), Downwelling Photosynthetically Active Radiation (`DOWNWELLING_PAR`), Nitrate (`NITRATE`), pH (`PH_IN_SITU_TOTAL`).

## 4. North Indian Ocean Bootstrap Dataset (TASK-01G)

The pinned bootstrap observation suite covers the North Indian Ocean domain (Lat 0°–30°N, Lon 40°–100°E):

| Profile File | DAC | WMO ID | Cycle | Mode | Region | Lat / Lon | Timestamp (UTC) | Parameters |
|---|---|---|---|---|---|---|---|---|
| `D1902669_012.nc` | INCOIS | `1902669` | 12 | Delayed (`D`) | Bay of Bengal | 13.317°N, 86.817°E | 2024-01-07T14:10:12Z | PRES, TEMP, PSAL (+ Adjusted) |
| `R1902581_050.nc` | Coriolis | `1902581` | 50 | Real-Time (`R`) | Equatorial Indian Ocean | 1.827°N, 76.830°E | 2024-11-30T17:49:30Z | PRES, TEMP, PSAL (+ Adjusted) |
| `SR1902594_001.nc` | Coriolis | `1902594` | 1 | Real-Time (`R`) | South of Sri Lanka | 5.359°N, 80.069°E | 2023-06-16T15:35:13Z | PRES, TEMP, PSAL, DOXY, CHLA, BBP700, CDOM, PAR |

Filtered Regional Index Holdings:
- `data/raw/argo-gdac/ar_index_north_indian_ocean_prof.txt` (146,430 North Indian Ocean core profile records)
- `data/raw/argo-gdac/argo_synthetic_north_indian_ocean_prof.txt` (16,667 North Indian Ocean BGC synthetic profile records)

## 5. Quality Control and Missing Value Policy

- **QC Flag Normalization:**
  - `1`: Good data (fully accepted for analysis and rendering).
  - `2`: Probably good data.
  - `3`: Bad data that are potentially correctable.
  - `4`: Bad data (excluded from analysis and comparison).
  - `8`: Interpolated value.
  - `9`: Missing value (`99999.0f` fill value).
- **Adjusted Value Priority:**
  - Where `DATA_MODE == 'D'` (Delayed mode) or valid adjusted fields exist (`*_ADJUSTED_QC in {'1', '2'}`), scientific analysis and collocation default to adjusted values while retaining raw values in canonical provenance.
- **Physical Bounds Validation:**
  - Pressure: `0.0 <= PRES <= 2100.0 dbar`
  - Temperature: `2.0 <= TEMP <= 35.0 °C`
  - Salinity: `30.0 <= PSAL <= 38.5 PSU`
  - Dissolved Oxygen: `0.0 <= DOXY <= 400.0 µmol/kg`
  - Chlorophyll-a: `0.0 <= CHLA <= 15.0 mg/m³`

## 6. Manifest and Integrity

All acquired files are tracked in `data/manifests/argo-gdac/argo_gdac_manifest.json` with:
- SHA-256 cryptographic hashes.
- Byte sizes.
- Full coordinate and temporal bounds.
- Level counts and parameter ranges.
- Full licensing and attribution metadata.

## 7. Licensing and Attribution

- **Licence:** Argo Data Management Policy (Open Access, CC-BY 4.0 compatible).
- **Attribution:** "These data were collected and made freely available by the International Argo Program and the national programs that contribute to it (https://argo.ucsd.edu, https://www.ocean-ops.org). The Argo Program is part of the Global Ocean Observing System."
- **Citation:** Argo (2026). Argo float data and metadata from Global Data Assembly Centre (Argo GDAC). SEANOE. https://doi.org/10.17882/42182.
