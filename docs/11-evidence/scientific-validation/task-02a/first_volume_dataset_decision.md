# QuasarOS TASK-02A: First 3D Volume Rendering Slice Dataset Decision

> **Document Status:** CANONICAL SELECTION DECISION — TASK-02A  
> **Target Subsystem:** Scientific Volume Lab (WebGPU WGSL / WebGL 2 GLSL Raymarching Core)  
> **Decision Date:** 2026-08-30  
> **Author:** Scientific Data Architect  
> **Target Milestone:** TASK-02B through TASK-04 First 3D Volume Slice Execution

---

## 1. Executive Summary & Final Recommendation

### Formal Decision
The **primary dataset selected for the First 3D Volume Rendering Slice** in QuasarOS is:
**Copernicus Marine Physical 3D Potential Temperature (`copernicus_phy_thetao`)** from `GLOBAL_ANALYSISFORECAST_PHY_001_024`.

- **Backup / Secondary Comparison Field:** **HYCOM ESPC-D-V02 3D Water Temperature (`water_temp`)** from `ESPC-D-V02/t3z`.
- **Reference / Non-Volume Benchmark:** **INCOIS-BIO-ROMS** (Evaluated as a 2D surface field and theoretical vertical s-coordinate formulation testbed).

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║  RECOMMENDED FIRST 3D VOLUME SLICE:                                                             ║
║  Dataset:        Copernicus Marine Physical Analysis & Forecast (GLOBAL_ANALYSISFORECAST_PHY)   ║
║  Variable:       thetao (Sea Water Potential Temperature, standard_name: sea_water_potential_temp)║
║  Logical Shape:  (time: 7, depth: 31, latitude: 181, longitude: 97)                             ║
║  Spatial Grid:   Regular 0.0833° (~9 km) Equirectangular WGS84 (EPSG:4326)                      ║
║  Vertical Grid:  31 Standard z-levels (0.49 m surface down to 5727.9 m abyssal plain)           ║
║  Physical Range: 2.12 °C (abyssal cold bottom water) to 31.84 °C (warm tropical mixed layer)     ║
║  Total Score:    98 / 100                                                                        ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. Evaluation & Scoring Framework

Candidates were evaluated across seven essential criteria governing WebGPU/WebGL 3D raymarching, texture memory packing, bricking, and scientific accuracy.

| Evaluation Criterion | Description & Weight |
|---|---|
| **1. Vertical Structure & Depth Resolution (20%)** | Must have high-density, strictly monotonic vertical z-levels covering surface mixed layer to abyssal ocean. |
| **2. Horizontal Grid Uniformity & Regularity (20%)** | Regular, monotonic lat/lon grids enable direct, distortion-free 3D texture mapping and brick empty-space skipping. |
| **3. Multi-Variable Hydrodynamic Suite (15%)** | Availability of matching salinity, currents (u, v), and surface elevation for vector compositing and density derivations. |
| **4. Spatial Resolution & Feature Fidelity (15%)** | Fine spatial resolution capturing mesoscale eddies, thermal fronts, and upwelling structures. |
| **5. Scientific Metadata & CF Compliance (10%)** | Complete standard names, units, valid ranges, and explicit missing value/land masks. |
| **6. GPU Texture Memory & Bricking Alignment (10%)** | Spatial volume dimensions factorable into standard $32\times32\times32$ or $64\times64\times64$ texture sub-bricks with halos. |
| **7. Multi-Day Temporal Continuity (10%)** | Multi-timestep series allowing dynamic time-scrubbing and 4D temporal animation. |

---

## 3. Candidate Scoring Matrix

| Candidate Dataset | Vert. Depth (20) | Horiz. Grid (20) | Multi-Var Suite (15) | Spatial Res (15) | Metadata CF (10) | GPU Alignment (10) | Time Series (10) | **Total Score (100)** | Recommendation Status |
|---|---|---|---|---|---|---|---|---|---|
| **Candidate A: Copernicus Marine Physical `thetao`** | **20** (31 z-levels, 0.49–5728m) | **20** (Uniform 0.083° regular lat/lon) | **15** (Complete matching `so`, `uo`, `vo`, `zos`) | **15** (1/12° ~9 km eddy-resolving) | **10** (Full CF-1.8 metadata & standard names) | **9** ($181\times97\times31$ cleanly tiles to $32^3$ bricks) | **9** (7 daily forecast timesteps) | **98 / 100** | **SELECTED PRIMARY** |
| **Candidate B: HYCOM ESPC-D-V02 `water_temp`** | **19** (32 z-levels, 0–5000m) | **19** (Uniform 0.16° regular lat/lon) | **15** (Expanded suite: `salinity`, `u`, `v`, `ssh`) | **11** (1/6° ~18 km regional grid) | **9** (Standard names & float32 values) | **9** ($63\times63\times32$ near-exact $64\times64\times32$ brick) | **9** (7 daily forecast timesteps) | **91 / 100** | **APPROVED SECONDARY** |
| **Candidate C: INCOIS-BIO-ROMS `temp`** | **4** (Surface boundary level only in sample) | **18** (Uniform 0.083° regular lat/lon) | **10** (Biogeochemical suite: `salt`, `pH`, `pCO2`, `alk`, `dic`) | **14** (1/12° ~9 km high-resolution) | **8** (Zenodo DOI-backed metadata) | **3** (2D slice only; not full 3D volume on disk) | **5** (12 monthly climatology steps) | **62 / 100** | **REJECTED FOR 3D VOLUME (SURFACE BGC ONLY)** |

---

## 4. Technical Rationale & Deep Dive

### 4.1 Why Copernicus Marine `thetao` Wins
1. **Pristine Vertical Stratification:** Copernicus provides 31 vertical levels specifically distributed with dense resolution in the upper 200 meters (critical for thermocline and mixed-layer rendering) and geometrically spaced down to 5,728 meters.
2. **Coupled Hydrodynamic Variables:** In the exact same physical campaign, matching files for Salinity (`so`), Horizontal Currents (`uo`, `vo`), and Sea Surface Height (`zos`) exist on the exact same spatial grid and time coordinates. This enables immediate testing of:
   - Density and Sound Speed derived volumes (TEOS-10).
   - 3D Vector streamline and particle advection rendering.
3. **High Mesoscale Resolution:** At 0.0833° resolution across the Arabian Sea and Western Indian Ocean, dynamic structures like the Great Whirl, Somali Current, and Persian Gulf water outflows exhibit sharp thermal gradients ideal for transfer function tuning.

### 4.2 Why HYCOM is the Benchmark Secondary
HYCOM ESPC-D-V02 provides an exceptional 32-level z-grid with dimensions $(7, 32, 63, 63)$. Because $63\times63\times32$ closely matches a single $64\times64\times32$ GPU 3D texture volume, it serves as the perfect lightweight validation target for initial GPU shader kernel bootstrapping before rendering larger multi-brick domains.

### 4.3 Evaluation of INCOIS-BIO-ROMS
The open DOI-backed Zenodo archive for INCOIS-BIO-ROMS (`10.5281/zenodo.11670413`) provides high-resolution 2D surface fields for temperature, salinity, and carbon chemistry. However, full 3D baroclinic terrain-following s-coordinate volume archives are retained internally on INCOIS OPeNDAP servers due to multi-terabyte storage constraints. Therefore, ROMS is categorized for **Surface Biogeochemical Raster rendering** and **Vertical S-Coordinate Algorithm Testing**, but is excluded from initial 3D volumetric raymarching.

---

## 5. Execution Parameters for TASK-02B Pipeline

When TASK-02B generates the canonical 3D volume artifacts for Copernicus `thetao`:

1. **Source File:** `data/raw/copernicus/physical/copernicus_phy_thetao_20250420_20250426.nc`
2. **Canonical Variable ID:** `sea_water_potential_temperature`
3. **Canonical Units:** `degree_Celsius` (converted from `degrees_C` / Kelvin representation if necessary)
4. **Volume Extent:**
   - Longitude: $60.0^\circ\text{E} \to 68.0^\circ\text{E}$ (97 grid cells)
   - Latitude: $0.0^\circ\text{N} \to 15.0^\circ\text{N}$ (181 grid cells)
   - Depth: $0.49\text{m} \to 5727.9\text{m}$ (31 non-uniform z-levels)
5. **GPU Texture Target Format:** `R16Float` (Half-precision floating point texture with step-size-corrected opacity raymarching).
