# TASK-12A: Multivariable Scientific Product and Contract Preflight Report

**Program:** PROGRAM-02 (QuasarOS v1.1.0-dev)
**Task:** TASK-12A - Scientific Product, Contract, and Capacity Preflight
**Status:** TASK-12A COMPLETE - MULTIVARIABLE EXPANSION DESIGN APPROVED
**Date:** 2026-08-30T23:57:00+05:30
**Governing Directives:** AGENTS.md SS1-18, docs/Arc.md, docs/Tech.md, ADR-0005
**Baseline Release:** RELEASE-01F confirmed - QuasarOS v1.0.0 VALIDATED AND READY FOR CONTROLLED DEPLOYMENT

---

## 1. v1.0.0 Baseline Preserved

The following v1.0.0 artifacts are frozen and immutable. PROGRAM-02 must not modify them.

- Native NetCDF-4: data/raw/copernicus/physical/copernicus-phy-thetao-20260824-20260830-ca826087/copernicus_phy_thetao_20260824_20260830.nc
- Canonical Zarr: data/canonical/copernicus_phy_thetao/copernicus-phy-thetao-20260824-20260830-ca826087/
- Visualization bricks: data/visualization/copernicus_phy_thetao/copernicus-phy-thetao-20260824-20260830-ca826087/v1/
- Release manifest: quasaros_v1.0.0_release_manifest.json
- Checksums: quasaros_v1.0.0_checksums.sha256

Brick architecture confirmed from visualization_manifest.json:
- Brick core: 64x64x32 interior valid voxels
- Halo: 1-voxel horizontal (no vertical halo)
- Sample shape: 66x66x32
- Hierarchy: anisotropic 2x2 horizontal LOD pyramid (NOT octree)

---

## 2. Target Variables for PROGRAM-02

TASK-12 expands from thetao (31 depth levels) to 5 variables:

| Priority | Variable | CF Name | Dimensionality | Full-Depth |
|---|---|---|---|---|
| 1 | thetao | sea_water_potential_temperature | 3D scalar | Yes (~50 levels) |
| 2 | so | sea_water_salinity | 3D scalar | Yes (~50 levels) |
| 3 | uo | eastward_sea_water_velocity | 3D vector component | Yes (~50 levels) |
| 4 | vo | northward_sea_water_velocity | 3D vector component | Yes (~50 levels) |
| 5 | zos | sea_surface_height_above_geoid | 2D surface | N/A (no depth) |

All variables sourced from: GLOBAL_ANALYSISFORECAST_PHY_001_024 (dataset: cmems_mod_glo_phy_anfc_0.083deg_P1D-m)

### Items Requiring TASK-12B Verification (CANNOT be confirmed without downloading data):
1. Exact full-depth level count (estimated ~50, max depth ~5,727m)
2. Exact depth coordinate array values
3. Salinity units string in NetCDF attributes (may be "1e-3", "PSU", or "1")
4. Grid type and rotation for uo/vo (regular lon/lat assumed; must be confirmed)
5. Grid coordinate sharing across all 5 variables
6. Exact fill_value string in each variable's NetCDF attributes
7. Exact valid_min/valid_max values per variable
8. Analysis vs. forecast classification per timestamp

---

## 3. Scientific Concerns

### 3.1 Salinity Units
The oceanographic community has deprecated "PSU" in favor of the dimensionless unit "1" (SI-consistent).
Copernicus documentation variously uses "1e-3", "PSU", and "1". TASK-12B must read the exact units
attribute string from the downloaded NetCDF and use it verbatim in all canonical metadata.
Do NOT assume "PSU" without metadata confirmation.

### 3.2 Current Vector Orientation
The CF standard name "eastward_sea_water_velocity" implies geographic (east/north) orientation.
However, some CMEMS products distribute velocity on rotated or curvilinear grids. TASK-12B must
verify the grid_mapping attribute in the downloaded uo/vo NetCDF to confirm no rotation is needed.
Speed = sqrt(uo^2 + vo^2) must NOT be computed until orientation is confirmed.

### 3.3 Valid Zero Values
All five variables can have physically valid values of 0.0 (or near 0.0). The Uint16 quantization
offset must be chosen to ensure 0.0 maps to a Uint16 code well away from 65535 (the missing sentinel).
This is verified in task_12a_scientific_error_budgets.json.

### 3.4 Vector Pair Validity Rule
If EITHER uo OR vo is masked/missing at a grid cell, BOTH components must be flagged invalid for
any vector operation. A speed derived from one valid and one missing component is scientifically
invalid and must never be computed or displayed.

### 3.5 zos as 2D Surface
Sea-surface height (zos) has no depth dimension. It must be rendered as a 2D time-varying surface
field with a dedicated rendering path. It must NOT be extruded into a fake 3D volume.

---

## 4. Full-Depth Strategy

### 4.1 Depth Levels
v1.0.0 activates 31 levels from 0.494m to 453.938m.
Full-depth thetao, so, uo, vo expected to use ~50 levels to ~5,727.917m.
TASK-12B must read the complete provider depth coordinate array before any TASK-12C work begins.

### 4.2 Brick Vertical Strategy Decision

After evaluating three candidate strategies in task_12a_capacity_and_storage_model.json:

RECOMMENDED: Strategy A - 64x64x32 core with 2 vertical slabs

Justification:
- Reuses proven v1.0.0 brick infrastructure exactly (64x64x32 core, 66x66x32 sample shape)
- Two streaming requests per timestep for deep profiles (acceptable)
- Slab boundary requires halo voxels to prevent interpolation seams (documented, solvable)
- Fits within 50 MiB GPU ceiling per variable
- Lowest implementation risk for TASK-12C

The 1D depth LUT already supports non-uniform vertical coordinates. The slab boundary
voxels must overlap by 1 level to enable continuous piecewise linear interpolation across the seam.

Strategy B (64x64x64 single slab) wastes GPU memory on empty vertical padding.
Strategy C (64x64x16 multi-slab) incurs 4x request overhead with marginal benefit.

---

## 5. Snapshot Family Strategy (ADR-0010)

One versioned snapshot family per synchronized 7-day acquisition window.
Structure:
- One immutable native NetCDF-4 file per variable
- One lossless canonical Zarr store per variable
- One snapshot-family manifest linking all synchronized variable snapshots
- Family ID pattern: copernicus-phy-multivariable-YYYYMMDD-YYYYMMDD-{family_sha}

New family uses new versioned paths under:
- data/raw/copernicus/physical/{family_id}/{variable}/
- data/canonical/copernicus_phy_{variable}/{family_id}/
- data/visualization/copernicus_phy_{variable}/{family_id}/v1/

The v1.0.0 thetao snapshot remains in its existing path, unmodified.

---

## 6. Contract Evolution Summary (ADR-0010 through ADR-0014)

All contract changes are intentional versioned evolution, not schema drift.
See task_12a_contract_change_plan.json for full details.

Key additions required in TASK-12D:
- VariableType enum: SALINITY, EASTWARD_VELOCITY, NORTHWARD_VELOCITY, SEA_SURFACE_HEIGHT
- FieldDimensionality enum: SCALAR_3D, VECTOR_COMPONENT_3D, SURFACE_2D
- VectorComponentRelationship: uo <-> vo with joint validity enforcement
- SnapshotFamily model linking synchronized variable snapshots
- SurfaceProductManifest for 2D zos product
- variable_id parameter on all existing query endpoints
- New endpoints: /catalog/variables, /catalog/families, /queries/surface-value, /queries/vector-value
- Schema version: 1.0 -> 1.1 on all affected Pydantic models

All changes are backwards-compatible additions. No existing v1.0.0 fields are removed.

---

## 7. Architecture Decision Records

### ADR-0010: Multivariable Snapshot Family Strategy
Status: ACCEPTED
Decision: One NetCDF per variable per synchronized window. One family manifest.
Rationale: Preserves per-variable provenance and native files. Enables independent re-acquisition if one variable fails.

### ADR-0011: Full-Depth Brick Vertical Strategy
Status: ACCEPTED
Decision: 64x64x32 brick core with 2 vertical slabs for ~50 levels. 1-level vertical overlap at slab boundary.
Rationale: Reuses proven v1.0.0 brick pipeline. Slab boundary handled by documented halo pattern. Lower risk than changing brick depth dimension.

### ADR-0012: zos as 2D Surface Product
Status: ACCEPTED
Decision: zos is stored as a time x lat x lon array and rendered as a 2D surface. No 3D extrusion.
Rationale: Scientific correctness. SSH has no depth dimension. Fake 3D extrusion would violate AGENTS.md data modeling rules.

### ADR-0013: uo/vo Separate Storage with Shared Joint Validity
Status: ACCEPTED
Decision: uo and vo stored in separate brick files. A single joint validity mask covers both. Any cell invalid in either component is invalid for both.
Rationale: Separate storage enables independent rendering of each component magnitude. Joint validity prevents scientifically invalid partial vectors.

### ADR-0014: Salinity Units Terminology Policy
Status: ACCEPTED
Decision: Use the exact provider units string from the downloaded NetCDF attribute. Do not assume "PSU". If provider says "1e-3" or "1", use that string in all canonical metadata and UI labels.
Rationale: Scientific accuracy. "PSU" is deprecated per IOC/SCOR/IAPSO 2010 and TEOS-10.

---

## 8. Memory and Concurrency Policy

Existing limits preserved:
- 50.0 MiB in-memory LRU cache
- 50.0 MiB GPU texture pool
- 6 concurrent HTTP streams maximum

Multi-variable impact:
- A single full-depth 3D variable at LOD 0 requires approximately 12 MiB GPU texture
- At most 2 full-depth 3D variables can be simultaneously resident at LOD 0 within 50 MiB ceiling
- When user selects a third variable, the least-recently-used variable must be evicted
- A memory warning UI must alert users when loading expensive combinations
- zos (2D surface) requires <1 MiB GPU texture - minimal impact

---

## 9. Acceptance Criteria for TASK-12B

TASK-12B may begin only after:
1. Credentials are confirmed rotated (per AGENTS.md security rules)
2. TASK-12A gate is passed (this report)

TASK-12B must verify before producing any canonical output:
1. Full-depth level count read from actual downloaded file
2. Depth coordinate array values read and recorded
3. Salinity units string confirmed from NetCDF attributes
4. Grid type confirmed for uo/vo (no rotation assumed)
5. Grid coordinate sharing confirmed for all 5 variables
6. Fill values confirmed for all 5 variables

---

## 10. Stop Conditions

TASK-12B must STOP immediately if:
- Credential rotation cannot be confirmed
- Provider file checksum fails
- Depth coordinate is non-monotonic
- Grid sharing cannot be confirmed (requires architecture decision before proceeding)
- Salinity fill value or valid range is inconsistent with known ocean values
- uo/vo grid requires rotation (requires a rotation matrix and additional design)
- File is truncated or dimensions do not match documented product specification

---

## 11. Deliverables Produced by TASK-12A

1. task_12a_multivariable_scientific_product_and_contract_preflight_report.md (this file)
2. task_12a_variable_inventory.json - Per-variable metadata inventory with REQUIRES_VERIFICATION flags
3. task_12a_capacity_and_storage_model.json - Storage estimates and brick strategy evaluation
4. task_12a_contract_change_plan.json - Schema evolution plan
5. task_12a_scientific_error_budgets.json - Per-variable quantization error budgets

---

TASK-12A COMPLETE - MULTIVARIABLE EXPANSION DESIGN APPROVED
