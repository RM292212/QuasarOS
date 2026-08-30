# Autonomous Ocean Glider Data Source Specification

**File:** `docs/03-science-data/sources/GliderSources.md`  
**Status:** Normative  
**Subsystem:** Scientific Data Ingestion & In-Situ Observation Model (`TASK-01I`)

## 1. Overview

Autonomous underwater gliders (e.g., Teledyne Webb Slocum, Kongsberg Seaglider, Alseamar SeaExplorer) perform sawtooth undulating trajectories through the ocean water column, providing high-resolution physical and biogeochemical transects.

For QuasarOS and QuasarOceanScope, autonomous glider mission data serves as authoritative continuous high-resolution vertical in-situ ground truth for:
- 3D/4D trajectory and sawtooth profile visualization in the Scientific Volume Lab.
- Mesoscale eddy boundary layer tracking, barrier layer identification, and pycnocline/thermocline characterization.
- Sub-mesoscale hydrodynamic model validation (HYCOM, Copernicus Marine PHY).
- Collocated sensor cross-validation with Argo floats (TASK-01B, TASK-01G) and satellite ocean color (TASK-01D).

## 2. Global Glider Assembly Centres and Access Endpoints

Authoritative repository hubs:
- **IOOS National Glider Data Assembly Center (NGDAC):** `https://gliders.ioos.us/erddap/`
- **OceanGliders GDAC (IFREMER / Coriolis / SEANOE):** `https://data-argo.ifremer.fr/dac/oceangliders/` / `https://www.seanoe.org/data/00453/56509/`
- **IMOS Australian National Facility for Ocean Gliders (ANFOG):** `https://data.aodn.org.au/`
- **INCOIS National Glider Program:** `https://erddap.incois.gov.in/erddap/`

Data access protocol:
- OPeNDAP and RESTful ERDDAP tabledap endpoints providing CF-1.6 / OceanGliders-1.0 compliant NetCDF (`.nc`) and structured JSON trajectories.

## 3. North Indian Ocean Benchmark Glider Mission (TASK-01I)

The bootstrap dataset is the **Rutgers / UWA Challenger Glider RU29 Mission** across the Northern Equatorial Indian Ocean, Bay of Bengal entrance, and Sri Lanka Dome:

| Parameter | Specification |
|---|---|
| **Mission / Platform** | Rutgers Challenger Glider RU29 (`ru29-20180812T0220`) |
| **WMO Platform ID** | `2801900` |
| **Glider Type** | Teledyne Webb Slocum G2 Electric Glider |
| **Institutions** | Rutgers University (RU-COOL), University of Western Australia (UWA), IOOS NGDAC |
| **Geographic Domain** | North Indian Ocean / Bay of Bengal / Sri Lanka Dome |
| **Latitude Range** | `1.088°N` to `8.665°N` |
| **Longitude Range** | `79.952°E` to `82.981°E` |
| **Vertical Range** | `1.01 m` to `965.0 m` depth (`1.01` to `965.0 dbar` pressure) |
| **Temporal Coverage** | `2018-08-12T02:36:01Z` to `2018-11-01T14:55:49Z` (81-day continuous transect) |
| **Total Observation Points** | `88,038` high-frequency trajectory records |
| **Unique Profiles** | `951` vertical dive and climb profiles |

## 4. Measured and Derived Scientific Variables

1. **Physical State Variables:**
   - Depth (`depth`): `1.01` to `965.00 m` (float32)
   - Pressure (`pressure`): `1.01` to `965.00 dbar` (float32)
   - Sea Water Temperature (`temperature`): `6.57` to `29.80 °C` (mean: `12.70 °C`)
   - Practical Salinity (`salinity`): `33.64` to `35.91 PSU` (mean: `35.04 PSU`)
   - In-Situ Density (`density`): `1021.17` to `1031.80 kg/m³` (mean: `1028.19 kg/m³`)
   - Electrical Conductivity (`conductivity`): `3.53` to `5.80 S/m`
2. **Kinematic & Hydrodynamic Variables:**
   - Depth-averaged Eastward Velocity (`u`): `m/s`
   - Depth-averaged Northward Velocity (`v`): `m/s`

## 5. Quality Control and Missing Value Policy

- **QC Flag Frameworks:**
  - **QARTOD Primary Flags:** `qartod_temperature_primary_flag`, `qartod_salinity_primary_flag`, `qartod_pressure_primary_flag`, `qartod_density_primary_flag`, `qartod_conductivity_primary_flag`, `qartod_location_test_flag`.
  - **Variable QC Flags:** `temperature_qc`, `salinity_qc`, `pressure_qc`, `depth_qc`, `density_qc`, `conductivity_qc`.
- **Flag Semantics:**
  - `1`: Pass (Good data, authoritative for 3D rendering and scientific collocation).
  - `2`: Not Evaluated.
  - `3`: Suspect / Warning.
  - `4`: Fail (Rejected from model comparison).
  - `9`: Missing value.
- **Physical Bounds Validation:**
  - `0.0 <= depth <= 1200.0 m`
  - `0.0 <= pressure <= 1200.0 dbar`
  - `2.0 <= temperature <= 35.0 °C`
  - `30.0 <= salinity <= 38.5 PSU`
  - `1015.0 <= density <= 1040.0 kg/m³`

## 6. Manifest and Integrity

All acquired files are tracked in `data/manifests/gliders/gliders_manifest.json` with:
- SHA-256 cryptographic hashes.
- Byte sizes.
- Full coordinate, vertical, and temporal extents.
- Variable level statistics and valid count tracking.
- Open access licensing and attribution.

## 7. Licensing and Attribution

- **Licence:** Creative Commons Attribution 4.0 International (CC-BY 4.0) / IOOS Data Policy.
- **Attribution:** "Rutgers University Center for Ocean Observing Leadership (RU-COOL), University of Western Australia (UWA), and the IOOS National Glider Data Assembly Center (NGDAC)."
- **Citation:** Challenger Glider Mission RU29 (2018). High-resolution autonomous underwater glider transect across the Northern Equatorial Indian Ocean and Sri Lanka Dome. IOOS Glider DAC.
