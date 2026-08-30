# TASK-05A Preflight & Architecture Report: Catalog, Authority, and Service Specification

**Status:** `TASK-05A COMPLETE — CATALOG AND AUTHORITY DESIGN APPROVED`  
**Execution Timestamp:** 2026-08-30T20:15:00+05:30 (2026-08-30T14:45:00Z)  
**Role:** Data Catalog and Scientific Authority Architect  
**Governing Directives:** `AGENTS.md`, `docs/INDEX.md`, `docs/Arc.md`, `docs/Tech.md`, `docs/02-architecture/APIContracts.md`, `docs/02-architecture/DataModeling.md`, `docs/02-architecture/ErrorModel.md`, `docs/03-science-data/CoordinateSystems.md`, `docs/03-science-data/VerticalCoordinates.md`, `docs/03-science-data/MissingDataAndMasks.md`  
**Machine-Readable Preflight Artifact:** [`data/manifests/catalog/task_05a_preflight.json`](data/manifests/catalog/task_05a_preflight.json)

---

## 1. Executive Summary & Objectives

TASK-05A establishes the foundational catalog, scientific authority matrix, coordinate resolution mechanics, and service routing layout for the upcoming Phase 5 microservices (`TASK-05B` Catalog API, `TASK-05C` Authoritative Exact-Value API, and `TASK-05D` Integration). 

All physical data assets generated across TASK-01 through TASK-04 were audited bitwise against their recorded cryptographic digests. Terminology was reconciled to strict NIST FIPS 180-4 SHA-256 cryptographic checksums, eliminating imprecise references to "signatures". The three-tier scientific authority hierarchy was formalized under ADR-0005, guaranteeing that approximate GPU rendering volumes never serve exact scientific values.

---

## 2. Artifact Path & Cryptographic Integrity Reconciliation

All repository-relative paths for all TASK-01 through TASK-04 data artifacts were audited. Every file exists on disk and its SHA-256 digest matches expected values.

### 2.1 Asset Inventory & Hash Verification Table

| Asset Layer | Relative Path | Format / Content | SHA-256 Hex Digest | Verification Status | Authority Status |
|---|---|---|---|---|---|
| **Raw Provider NetCDF** | `data/raw/copernicus/physical/copernicus-phy-thetao-20260824-20260830-ca826087/copernicus_phy_thetao_20260824_20260830.nc` | NetCDF-4 (HDF5) $7\times31\times181\times97$ float32 | `ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c` | **Bitwise Verified** | **Tier 1: Authoritative Exact Scientific Truth** |
| **Canonical Zarr (Operational)** | `data/canonical/copernicus_phy_thetao/copernicus-phy-thetao-20260824-20260830-ca826087` | Zarr Store (11 sub-keys, IEEE-754 float32 + uint8 mask) | Directory store verified against acquisition manifest | **Verified** | **Tier 2: Lossless Processing Representation** |
| **Canonical Zarr (Historical v1)** | `data/canonical/copernicus_phy_thetao/v1` | Zarr Store (11 sub-keys, baseline validation) | `6b4ce3f47a77add27541ed836870dba9bcd6a2c34d258e6787a542e660627281` | **Verified** | **Tier 2: Lossless Processing Representation** |
| **Visualization Volume Bricks** | `data/visualization/copernicus_phy_thetao/copernicus-phy-thetao-20260824-20260830-ca826087/v1` | 63 bricks (126 zstd payloads: 63 F16, 63 U16, 12.72 MiB) | Bitwise checked in TASK-04D | **Bitwise Verified** | **Tier 3: Approximate GPU Visualization Payloads** |
| **Acquisition Manifest** | `data/manifests/copernicus-physical/copernicus-phy-thetao-20260824-20260830-ca826087/acquisition_manifest.json` | JSON Metadata | `0861401c53c9c03ec66362c69a1e6935e5d22cfffb11dc50d2217b53204dbd73` | **Bitwise Verified** | Lineage Document |
| **Validation Report** | `data/manifests/copernicus-physical/copernicus-phy-thetao-20260824-20260830-ca826087/validation_report.json` | JSON Metadata | `c1f44251d58e3f589b51651ae7f003c44ef0b1764abc61510bc79d8a71c9d248` | **Bitwise Verified** | Quality Audit Record |
| **Parity Validation Report** | `data/manifests/copernicus-physical/copernicus-phy-thetao-20260824-20260830-ca826087/parity_validation_report.json` | JSON Metadata | `047409f5f0085ea545ab1d07d69f32bcb2506d201081c9043e86cc74d5aa9df9` | **Bitwise Verified** | Numerical Parity Record |
| **Visualization Manifest (Canonical)** | `data/manifests/visualization/copernicus_phy_thetao/copernicus-phy-thetao-20260824-20260830-ca826087/v1/visualization_manifest.json` | JSON Contract | `78644572a8478a100377bb5032c26b7f5163217fe1203868265d814285deda59` | **Bitwise Verified** | Visualization Metadata |
| **Visualization Manifest (Product Copy)** | `data/visualization/copernicus_phy_thetao/copernicus-phy-thetao-20260824-20260830-ca826087/v1/visualization_manifest.json` | JSON Contract | `78644572a8478a100377bb5032c26b7f5163217fe1203868265d814285deda59` | **Bitwise Verified** | Standalone Product Manifest |
| **Active Snapshot Catalog** | `data/manifests/active_snapshot_catalog.json` | JSON Catalog Registry | `e4d67295bd0d1d3c809fdc05748eb2e59ea9608e3874bb6d48f960a39bc33230` | **Bitwise Verified** | Authoritative System Catalog |
| **Architectural Decision Record** | `data/manifests/visualization/task_04a_decision.json` | JSON Record | `394e261acd85fcdfed8c26451761d2c8ad0b2312fae66e027f807dfb8f3b17f4` | **Bitwise Verified** | Volume Bricking Decision |

### 2.2 Integrity Terminology Reconciliation

- **Reconciled Terminology:** "Cryptographically checksummed using SHA-256" (SHA-256 Digest NIST FIPS 180-4).
- **Correction:** All previous colloquial or shorthand references to "cryptographically signed assets" in documentation and logs are ratified as cryptographic SHA-256 hash digests. Asymmetric public-key cryptographic signatures (e.g. Ed25519/GPG) are reserved for remote bundle distribution if deployed.

---

## 3. Scientific Authority & Architecture Matrix (ADR-0005)

Under `AGENTS.md` Directive 2 and ADR-0005, QuasarOS strictly enforces scientific authority tiers to guarantee separation of authoritative measurements from visual approximations:

```
+-----------------------------------------------------------------------------------+
| Tier 1: Authoritative Native Scientific Truth                                      |
| Raw Provider NetCDF-4 / GRIB2 / GDAC Profiles                                      |
| - Exact IEEE-754 floating point values                                            |
| - Immutable baseline for collocations, exact queries, and regulatory audits       |
| - is_eligible_for_exact_query = True                                              |
| - Response Envelope: ExactValueQueryResponse                                      |
+-----------------------------------------------------------------------------------+
                                         |
                                         v (Lossless Extraction)
+-----------------------------------------------------------------------------------+
| Tier 2: Lossless Processing Representation                                         |
| Canonical Zarr Array Stores (v2 / v3)                                             |
| - High-throughput slicing, spatial indexing, chunked parallel processing          |
| - Retains full categorical validity masks and dimension coordinates               |
| - Response Envelope: CanonicalDataset / Zarr Slices                               |
+-----------------------------------------------------------------------------------+
                                         |
                                         v (Spatial Decimation & Affine Quantization)
+-----------------------------------------------------------------------------------+
| Tier 3: Approximate GPU Visualization Payloads                                    |
| Multiresolution Volume Bricks (r16float / r16uint Zstandard)                      |
| - Sub-sampled LODs, non-linear depth LUT mapping, 16-bit precision loss           |
| - STRICTLY FORBIDDEN FROM SERVING EXACT SCIENTIFIC TRUTH                          |
| - is_eligible_for_exact_query = False (Mandatory Guard)                           |
| - Response Envelope: ProvisionalRenderPickResponse                                |
+-----------------------------------------------------------------------------------+
```

### 3.1 Authority Matrix Summary

1. **Provider NetCDF (Tier 1):**
   - **Data Store:** `data/raw/copernicus/physical/.../copernicus_phy_thetao_20260824_20260830.nc`
   - **Format:** NetCDF-4 (HDF5-backed).
   - **Role:** The authoritative scientific baseline for exact numerical evaluations, point inspections, and profile casts.
   - **Exact Query Eligibility:** `True`.

2. **Canonical Zarr (Tier 2):**
   - **Data Store:** `data/canonical/copernicus_phy_thetao/copernicus-phy-thetao-20260824-20260830-ca826087`
   - **Format:** Zarr v2.
   - **Role:** High-performance processing and analysis store. Bitwise lossless to Tier 1, but designated as a processing intermediate under ADR-0005.
   - **Exact Query Eligibility:** `False` (for exact compliance queries; Tier 1 raw NetCDF remains primary).

3. **Visualization Bricks (Tier 3):**
   - **Data Store:** `data/visualization/copernicus_phy_thetao/.../v1/`
   - **Format:** Compressed binary payloads (`r16float`, `r16uint`).
   - **Role:** Interactive volume raymarching in WebGPU/WebGL2 Volume Lab viewports.
   - **Exact Query Eligibility:** `False`. Explicitly carries `QuantizationContract.is_eligible_for_exact_query = False` and returns `ProvisionalRenderPickResponse` with error confidence bounds ($\pm0.00781\,^\circ\text{C}$ for Float16, $\pm0.00016\,^\circ\text{C}$ for Uint16).

---

## 4. Service Architecture & Existing Conventions Inspection

Inspection of the repository structure shows the existing package layout:
- `packages/contracts/` (`quasar_contracts`): Contains all normative Pydantic models and JSON schemas (`exact_value_contracts.py`, `canonical_dataset.py`, `visualization_contracts.py`, etc.).
- `packages/ingestion/` (`quasar_ingestion`): Contains provider adapters, canonical Zarr writers, and multiresolution brick generators.

### 4.1 Target Layout for Phase 5 Services (`packages/services/` or `quasar_services`)

To maintain clean modularity without circular dependencies:
- **New Package:** `packages/services/` (`quasar_services`)
- **Framework:** FastAPI with Uvicorn, structured routers, strict dependency injection, and Pydantic v2 request/response models.
- **Root Directory:** `packages/services/src/quasar_services/`
  - `main.py`: FastAPI application factory with CORS middleware, request ID tracking, error handling handlers, and `/health` probes.
  - `config.py`: Environment settings, catalog path configuration, and security limits.
  - `catalog/`: Catalog router (`/api/v1/catalog`, `/api/v1/datasets`, `/api/v1/render-manifests`, `/api/v1/capabilities`) and active repository loader.
  - `queries/`: Authoritative exact-value query engine (`/api/v1/queries/value`, `/api/v1/queries/profile`, `/api/v1/queries/reconcile-pick`).
  - `security/`: Path traversal guards, query bounds validators, and rate limiters.

### 4.2 Required Endpoints Inventory

#### Catalog & Manifest Service (TASK-05B)
1. `GET /health/live` & `GET /health/ready`: Microservice liveness and readiness probes.
2. `GET /api/v1/catalog`: Search and list all active snapshots, historical baselines, datasets, and variables.
3. `GET /api/v1/datasets/{dataset_id}`: Dataset identity, bounding extents, vertical depth LUT, and time axis metadata.
4. `GET /api/v1/datasets/{dataset_id}/variables`: List available variables, CF standard names, units, and ranges.
5. `GET /api/v1/datasets/{dataset_id}/times`: List valid UTC timestamps, step indices, and temporal classifications.
6. `GET /api/v1/render-manifests/{visualization_product_id}`: Multi-resolution volume rendering manifest, brick geometry, LOD levels, quantization parameters, and brick download URL templates.
7. `GET /api/v1/capabilities`: Engine capabilities, supported coordinate frames, selection algorithms, and GPU backend support.

#### Authoritative Exact-Value Service (TASK-05C)
1. `POST /api/v1/queries/value`: Authoritative point evaluation returning `ExactValueQueryResponse`.
2. `POST /api/v1/queries/profile`: Authoritative 1D vertical column cast returning array of evaluations across depth levels.
3. `POST /api/v1/queries/reconcile-pick`: Provisional pick reconciliation converting viewport raycast coordinates to authoritative exact values.

---

## 5. Exact Query Semantics Specification

Scientific exact queries must satisfy strict mathematical resolution policies:

### 5.1 Non-Uniform Depth Resolution (LUT Binary Search)
- Copernicus depth levels are non-uniform: 31 levels from $0.494\,\text{m}$ to $453.938\,\text{m}$ with layer thicknesses stretching from $1.05\,\text{m}$ at surface to $73.72\,\text{m}$ at depth.
- **Resolution Strategy:** Exact binary search (`bisect_left`/`bisect_right` on the sorted 31-level depth LUT) to identify the nearest native vertical level.
- **Contract Fields Reported:**
  - `requested_vertical_target_value` (e.g. $50.0\,\text{m}$).
  - `resolved_depth_m` (e.g. $47.37369\,\text{m}$).
  - `depth_delta_m` (e.g. $-2.62631\,\text{m}$).
  - `vertical_level_index` (e.g. index 17).

### 5.2 Geographic Coordinate Resolution
- Native grid resolution is uniform $1/12^\circ \approx 0.0833333^\circ$ across $[-3.0^\circ\text{N}, 12.0^\circ\text{N}] \times [80.0^\circ\text{E}, 88.0^\circ\text{E}]$.
- **Nearest Native Mode (Default):** Calculates grid indices:
  $$\text{lat\_idx} = \text{round}\left(\frac{\text{lat} - \text{lat\_min}}{\Delta\text{lat}}\right), \quad \text{lon\_idx} = \text{round}\left(\frac{\text{lon} - \text{lon\_min}}{\Delta\text{lon}}\right)$$
- **Reported Metadata:**
  - `requested_latitude_deg`, `requested_longitude_deg`.
  - `resolved_latitude_deg`, `resolved_longitude_deg`.
  - `horizontal_distance_delta_km` (Haversine/geodesic distance).
  - `grid_index_evaluated` ($[t, z, y, x]$).

### 5.3 Missing-Value & Mask Preservation
- Under `MissingDataAndMasks.md`, missing, land, or below-seabed cells **must never be interpreted as physical $0.0\,^\circ\text{C}$**.
- The exact query engine checks native NetCDF fill values (`_FillValue`, `NaN`, `-32767`, etc.) and canonical categorical flags (`VALID=0`, `SOURCE_MISSING=1`, `LAND=2`, `BELOW_SEABED=3`, `OUTSIDE_DOMAIN=4`, `QC_REJECTED=5`, etc.).
- When a cell is non-valid:
  - `scientific_value` is set to `null` (`None`).
  - `value_state` is set to the specific `PhysicalCellState` enum.
  - Distinguishes valid freezing water ($0.0\,^\circ\text{C}$) from invalid/missing data.

### 5.4 Provisional Render-Pick Reconciliation Flow
1. User hovers in 3D Volume Lab -> Viewport raymarches through GPU Float16 brick -> Returns `ProvisionalRenderPickResponse` with `approximate_render_sample` discriminator and notice.
2. User clicks on voxel or requests scientific inspection -> Frontend sends `POST /api/v1/queries/reconcile-pick` with `world_ray_hit_position` $[x, y, z]$.
3. Service uses inverse coordinate transform (`LocalCartesianBounds` -> WGS84 Geodetic) to recover `(lat, lon, depth)`.
4. Service queries native Tier 1 NetCDF array at resolved coordinate.
5. Service returns `ExactValueQueryResponse` with full provenance, source NetCDF SHA-256 hash (`ca826087...`), evaluated discrete grid index, and authoritative floating-point value.

---

## 6. Security Boundaries & Protection Measures

1. **Path Traversal Prevention:** Catalog and render manifest loaders strictly validate requested IDs against the immutable active snapshot registry. File paths outside `data/` are rejected with `403 Forbidden` / `400 Bad Request`.
2. **Bounded Resource Queries:** Point queries, profile extractions, and temporal intervals are capped with maximum slice dimensions to prevent memory exhaustion or denial of service.
3. **No Secret Leakage:** Service responses and error payloads adhere to `docs/02-architecture/ErrorModel.md`, stripping internal filesystem paths or environment secrets.
4. **Direct Binary Object Offloading:** Large volume binary bricks continue to be streamed directly via storage/CDN URLs bypassing the FastAPI process.

---

## 7. Downstream Implementation & Test Plan

```
+--------------------------------------------------------------------------------+
| TASK-05A: Preflight, Catalog Design & Authority Matrix (Completed)              |
+--------------------------------------------------------------------------------+
                                        |
                                        v
+--------------------------------------------------------------------------------+
| TASK-05B: Catalog & Manifest Service (FastAPI)                                 |
| - Implement `packages/services/src/quasar_services/`                           |
| - Endpoints: `/catalog`, `/datasets/{id}`, `/times`, `/render-manifests/{id}`  |
| - Unit & integration tests against active operational snapshot                 |
+--------------------------------------------------------------------------------+
                                        |
                                        v
+--------------------------------------------------------------------------------+
| TASK-05C: Authoritative Exact-Value & Profile Engine                           |
| - Implement `ExactQueryEngine` against NetCDF Tier 1 source                    |
| - LUT binary search, nearest/bilinear interpolation, missing value masking     |
| - Endpoints: `/queries/value`, `/queries/profile`, `/queries/reconcile-pick`   |
| - Numerical verification against ground-truth arrays                           |
+--------------------------------------------------------------------------------+
                                        |
                                        v
+--------------------------------------------------------------------------------+
| TASK-05D: Integration & Conformance Test Suite                                 |
| - Full HTTP client integration tests with TestClient                           |
| - Failure injection (corrupted headers, out-of-domain coordinates)             |
| - Full test suite pass (285+ tests) and handoff to 3D Renderer                 |
+--------------------------------------------------------------------------------+
```

---

## 8. Handoff & Completion Declaration

All prerequisites for Phase 5 backend services have been verified and documented. The active operational snapshot (`copernicus-phy-thetao-20260824-20260830-ca826087`) and multiresolution visualization pyramid ($12.72\,\text{MiB}$) are fully integrated and ready for service deployment in TASK-05B.

**Completion Status:**  
`TASK-05A COMPLETE — CATALOG AND AUTHORITY DESIGN APPROVED`
