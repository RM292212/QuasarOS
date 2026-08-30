# QuasarOS TASK-02A: Proposed Contract Gaps & Canonical Schema Roadmap

> **NOTICE:** PROPOSED — NOT YET IMPLEMENTED OR FROZEN  
> **Audience:** Architecture, Scientific Data, Backend-Contract, and Rendering Subsystems  
> **Task Target:** Inputs and Gap Specifications for TASK-02B+  
> **Date:** 2026-08-30

---

## 1. Context & Purpose

This document details the scientific contract gaps identified during the TASK-02A audit across all 16 distinct dataset products. It outlines the precise mathematical and schema transformations required when constructing the canonical data models in TASK-02B.

---

## 2. Identified Contract Gaps by Scientific Domain

### 2.1 Vertical Coordinate Gaps
- **Gap 1 (Non-Uniform z-levels vs GPU Uniform Texture Memory):**
  - *Observation:* Copernicus (31 levels), HYCOM (32 levels), and WOA23 (102 levels) use non-uniform geometric depth spacing (e.g. 0.5m, 1.5m ... 500m ... 5000m).
  - *Requirement for TASK-02B:* The canonical schema must preserve exact physical depth coordinates in meters. The rendering bricking pipeline must either:
    1. Provide 1D depth transfer LUTs in the shader uniforms, or
    2. Support coordinate-aware non-linear raymarching step functions, or
    3. Document an authoritative interpolation method to uniform vertical texture space with bounded error quantification.
- **Gap 2 (Terrain-Following $\sigma$ / s-levels):**
  - *Observation:* Regional models like ROMS define vertical coordinates as fractional levels $s \in [-1, 0]$ that stretch based on dynamic sea surface height $\zeta(x,y,t)$ and bathymetry $h(x,y)$.
  - *Requirement for TASK-02B:* Canonical schema must support `vertical_coordinate_type: "terrain_following_s_coordinate"` with required parameter fields:
    ```json
    {
      "Vtransform": 1,
      "Vstretching": 1,
      "theta_s": 7.0,
      "theta_b": 0.1,
      "hc": 10.0,
      "s_rho": [-0.975, -0.925, "...", -0.025],
      "Cs_r": [-0.95, -0.85, "...", -0.01]
    }
    ```

### 2.2 Vector Field Conventions & Grid Staggering
- **Gap 3 (Meteorological vs Oceanographic Directional Conventions):**
  - *Observation:* Wave datasets (Copernicus Waves `VMDR`, PacIOOS `dirpw`, INCOIS WW3 `dir`) define direction as **"direction from"** (meteorological convention, degrees clockwise from True North). Hydrodynamic current fields (`uo`, `vo`) define velocity vectors as **"direction to"** (oceanographic Cartesian velocity).
  - *Requirement for TASK-02B:* Canonical vector schema must explicitly mandate:
    ```json
    {
      "vector_convention": "oceanographic_to" | "meteorological_from",
      "reference_north": "geographic_true_north",
      "rotation_to_geographic_required": false
    }
    ```
- **Gap 4 (Arakawa C-Grid Staggering):**
  - *Observation:* Raw ROMS and MOM models compute $u$ on east-west cell faces and $v$ on north-south cell faces, staggered relative to tracer points $\rho(T, S)$.
  - *Requirement for TASK-02B:* Canonical schema must preserve grid staggering attributes or state if collocated interpolation has been applied.

### 2.3 Time Semantics & Epoch Alignment
- **Gap 5 (Heterogeneous Base Calendars & Units):**
  - *Observation:* Time coordinate encodings vary widely across providers:
    - Copernicus: `hours since 1950-01-01 00:00:00` (Gregorian)
    - HYCOM: `hours since 2000-01-01 00:00:00` (Standard)
    - INCOIS/PacIOOS: `seconds/hours since 1970-01-01 00:00:00` (Unix epoch)
    - Argo GDAC: `JULD` (Julian days since `1950-01-01 00:00:00 UTC`)
  - *Requirement for TASK-02B:* All canonical schemas must standardize on ISO 8601 UTC strings (`YYYY-MM-DDTHH:MM:SSZ`) and Unix timestamps in milliseconds for web client transport, while retaining the original provider time string in provenance metadata.
- **Gap 6 (Forecast Lead Time vs Valid Time):**
  - *Observation:* Operational models provide forecasts starting from an analysis reference time ($T_{\text{ref}}$) with varying lead times ($\tau$).
  - *Requirement for TASK-02B:* Every temporal record must distinguish:
    - `reference_time`: Forecast model run initialization time.
    - `lead_time_seconds`: Offset $\tau$.
    - `valid_time`: $T_{\text{ref}} + \tau$.

### 2.4 Missing Values & Quality Control Normalization
- **Gap 7 (Normalization of Diverse QC Standards):**
  - *Observation:* Ingested data use three distinct QC systems:
    1. WMO Argo Profile Flags (1=Good, 2=Probably Good, 3=Bad, 4=Bad, 9=Missing).
    2. IOOS QARTOD Flags (1=Pass, 2=Not Evaluated, 3=Suspect/Warning, 4=Fail, 9=Missing).
    3. GEBCO TID Measurement Provenance codes (0 to 100).
  - *Requirement for TASK-02B:* Schema must implement a normalized QC category mapping while never discarding the raw provider flag.

---

## 3. Proposed Canonical Schemas (Draft / Not Yet Frozen)

```json
// PROPOSED — NOT YET IMPLEMENTED OR FROZEN
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "QuasarOS Canonical 3D Volume Field Schema (Draft)",
  "type": "object",
  "required": [
    "dataset_id",
    "variable_id",
    "canonical_units",
    "spatial_domain",
    "vertical_domain",
    "temporal_domain",
    "data_payload"
  ],
  "properties": {
    "dataset_id": { "type": "string" },
    "variable_id": { "type": "string" },
    "standard_name": { "type": "string" },
    "canonical_units": { "type": "string" },
    "spatial_domain": {
      "type": "object",
      "properties": {
        "crs": { "type": "string", "enum": ["EPSG:4326", "EPSG:3857"] },
        "grid_type": { "type": "string", "enum": ["regular_lat_lon", "curvilinear", "unstructured"] },
        "latitude_bounds": { "type": "array", "items": { "type": "number" }, "minItems": 2, "maxItems": 2 },
        "longitude_bounds": { "type": "array", "items": { "type": "number" }, "minItems": 2, "maxItems": 2 },
        "shape": { "type": "array", "items": { "type": "integer" } }
      },
      "required": ["crs", "grid_type", "latitude_bounds", "longitude_bounds", "shape"]
    },
    "vertical_domain": {
      "type": "object",
      "properties": {
        "coordinate_type": { "type": "string", "enum": ["depth_z_level", "pressure_dbar", "terrain_following_s"] },
        "levels": { "type": "array", "items": { "type": "number" } },
        "positive_direction": { "type": "string", "enum": ["down", "up"] },
        "units": { "type": "string" }
      },
      "required": ["coordinate_type", "levels", "positive_direction", "units"]
    },
    "temporal_domain": {
      "type": "object",
      "properties": {
        "reference_time_utc": { "type": ["string", "null"] },
        "valid_time_utc": { "type": "string" },
        "timestep_index": { "type": "integer" }
      },
      "required": ["valid_time_utc", "timestep_index"]
    }
  }
}
```

---

## 4. Next Steps for TASK-02B
1. Finalize TypeScript interfaces under `packages/contracts/src/canonical/`.
2. Implement binary serialization / chunked zarr-compatible brick writer for volume rendering.
3. Construct canonical converters for Copernicus `thetao` and HYCOM `water_temp`.
