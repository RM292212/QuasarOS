# QuasarOS TASK-03A: Copernicus Physical Temperature Source & Pipeline Preflight Report

> **Document Status:** COMPLETE — TASK-03A SOURCE & PIPELINE PREFLIGHT  
> **Target Subsystem:** Data Ingestion & Canonical Storage (`data/raw/copernicus/physical/`, `packages/ingestion/`, `packages/contracts/`)  
> **Execution Date:** 2026-08-30  
> **Author:** Scientific Data Pipeline Architect  
> **Pipeline Target:** Task-03B Adapter Implementation & Task-04 Multiresolution Bricking

---

## 1. Executive Summary & Verification Matrix

In accordance with **ADR-0005** and QuasarOS governing principles, a comprehensive preflight inspection and canonicalization design was conducted on the authoritative raw source NetCDF asset for Copernicus Marine Physical Temperature.

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║  TASK-03A SOURCE PREFLIGHT VERIFICATION SUMMARY                                                  ║
║  Status:               TASK-03A COMPLETE — ADAPTER IMPLEMENTATION READY                         ║
║  Source NetCDF Asset:  data/raw/copernicus/physical/copernicus_phy_thetao_20250420_20250426.nc    ║
║  Companion Manifest:   data/manifests/copernicus-physical/copernicus_physical_manifest.json      ║
║  Byte Size Verified:   15,263,241 bytes (14.56 MiB)                                              ║
║  SHA-256 Checksum:     6b4ce3f47a77add27541ed836870dba9bcd6a2c34d258e6787a542e660627281 (MATCH) ║
║  Logical Dimensions:   (time: 7, depth: 31, latitude: 181, longitude: 97)                         ║
║  Total Elements:       3,809,869 float32 voxels (3,618,944 finite valid [94.99%], 190,925 masked)║
║  Physical Range:       9.5532 °C to 31.8478 °C (Mean: 25.2336 °C, Std: 7.1291 °C)                ║
║  Selected Chunk Shape: (1, 31, 64, 64) [Candidate 5 / 3D Spatial Tile: 496.00 KB per chunk]    ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. Source NetCDF Asset Inspection & Validation

### 2.1 File Integrity & Manifest Correlation
- **Target File Path:** `data/raw/copernicus/physical/copernicus_phy_thetao_20250420_20250426.nc`
- **File System Size:** `15,263,241` bytes
- **SHA-256 Digest:** `6b4ce3f47a77add27541ed836870dba9bcd6a2c34d258e6787a542e660627281`
- **Manifest Cross-Check:** SHA-256 matches `copernicus_physical_manifest.json` entry exactly (`6b4ce3f4...`).
- **Immutability Contract:** Verified that `data/raw/**` remains strictly read-only; no write operations or in-place modifications were performed.

### 2.2 Dimensions & Coordinate Verification
The dataset conforms to CF-1.8 conventions and defines 4 standard orthogonal coordinates:

| Coordinate | Dimension Size | Type | Units | Range / Values | Monotonicity |
|---|---|---|---|---|---|
| **`time`** | `7` | `float32` | `hours since 1950-01-01` | `660072.0` to `660216.0` (Daily 2025-04-20 to 2025-04-26) | Strictly Monotonic Increasing ($\Delta t = 24.0\text{ h}$) |
| **`depth`** | `31` | `float32` | `m` (`positive: down`) | `0.4940 m` down to `453.9377 m` | Strictly Monotonic Increasing (Non-uniform 31 z-levels) |
| **`latitude`** | `181` | `float32` | `degrees_north` | `-3.000^\circ\text{N}` to `+12.000^\circ\text{N}` ($\Delta y = 0.08333^\circ$) | Strictly Monotonic Increasing |
| **`longitude`** | `97` | `float32` | `degrees_east` | `80.000^\circ\text{E}` to `88.000^\circ\text{E}` ($\Delta x = 0.08333^\circ$) | Strictly Monotonic Increasing |

#### Depth Grid Structure (31 non-uniform levels):
`[0.494, 1.541, 2.646, 3.819, 5.078, 6.441, 7.930, 9.573, 11.405, 13.467, 15.810, 18.496, 21.599, 25.211, 29.445, 34.434, 40.344, 47.374, 55.764, 65.807, 77.854, 92.326, 109.729, 130.666, 155.851, 186.126, 222.475, 266.040, 318.127, 380.213, 453.938]`

### 2.3 Variable Attributes & Statistical Health
- **Variable Name:** `thetao`
- **Standard Name:** `sea_water_potential_temperature`
- **Long Name:** `Temperature`
- **Units:** `degrees_C`
- **Raw Type:** `float32` (Direct native float32 representation; no scaling/offset packing `scale_factor` / `add_offset` needed)
- **Missing Value / FillValue:** `9.969209968386869e+36`
- **Valid Bounds:** `[-10.0, 40.0] °C`
- **Total Voxels:** `7 * 31 * 181 * 97 = 3,809,869`
- **Finite Valid Values:** `3,618,944` (94.99%)
- **Missing / Masked Voxels:** `190,925` (5.01% — representing land boundaries and deep bathymetric exclusion)
- **Physical Min:** `9.553183 °C` (deep thermocline at 453.9m)
- **Physical Max:** `31.847761 °C` (tropical surface mixed layer)
- **Physical Mean / Std:** `25.233606 °C` / `7.1291285 °C`

---

## 3. Canonicalization Architecture & Plan

Under ADR-0005, the raw NetCDF file remains the immutable scientific archive. The canonical representation is generated via an idempotent ingestion adapter into a consolidated Zarr v2 store.

### 3.1 Identity & Metadata Mapping
- **Canonical Dataset ID:** `copernicus_phy_thetao`
- **Snapshot ID:** `copernicus_phy_thetao_20250420_20250426_v1`
- **Canonical Variable ID:** `sea_water_potential_temperature`
- **Dimension Order:** `('time', 'depth', 'latitude', 'longitude')` (4D standard C-contiguous)
- **Canonical Coordinate Names:** `time`, `depth`, `latitude`, `longitude`
- **Canonical Unit Representation:** `degree_Celsius` (UDUNITS-2 / CF standard representation conforming to `packages/contracts/schemas/canonical_unit.schema.json`)

### 3.2 Missing-Value & Validity Mask Strategy
- Missing values in the scientific float array are represented as standard IEEE 754 `NaN` (`f32::NAN`) with `.zattrs["_FillValue"] = NaN`.
- An explicit companion `validity_mask` `uint8` array of identical shape `(7, 31, 181, 97)` will be encoded with standard flags:
  * `0`: `VALID` (Observable ocean interior)
  * `1`: `SOURCE_MISSING` (Data unavailable from source provider)
  * `2`: `LAND` (Sub-aerial land surface)
  * `3`: `BELOW_SEABED` (Bathymetry cutoff)

### 3.3 Storage Format, Compression & Publication Safety
- **Format:** Zarr v2 specification with consolidated metadata (`.zmetadata`).
- **Compressor:** Blosc Zstandard (`cname="zstd"`, `clevel=5`, `shuffle=BITSHUFFLE`) for high decompression throughput in web workers and scientific kernels.
- **Output Target Path:** `data/canonical/copernicus_phy_thetao/v1/`
- **Staging Directory:** `data/canonical/.tmp_copernicus_phy_thetao_v1/`
- **Atomic Publication Protocol:**
  1. Ingestion adapter populates the staging directory completely.
  2. Integrity checksums (`manifest.json` and logical SHA-256 array hashes) are calculated and validated against the source.
  3. Atomic directory swap / rename moves `.tmp_copernicus_phy_thetao_v1/` to `v1/`.
  4. If an existing `v1/` is present, it is replaced atomically, eliminating partial/corrupted read states.

---

## 4. Chunking Analysis & Optimization

### 4.1 Candidate Evaluation Matrix

| Candidate | Chunk Dimensions `(t, z, y, x)` | Uncompressed Chunk Size | Total Chunks (7 Days) | Chunks / Timestep | Access Characteristics & Trade-offs |
|---|---|---|---|---|---|
| **Candidate 1: Full-Volume Slice** | `(1, 31, 181, 97)` | 2,126.04 KB (~2.08 MB) | 7 | 1 | **Fastest for full 3D brick generation** in Task-04; high memory footprint for single-point or horizontal 2D slice queries. |
| **Candidate 2: Time-Depth 2D Slice** | `(1, 1, 181, 97)` | 68.58 KB | 217 | 31 | Ideal for 2D horizontal map layers; highly inefficient for vertical soundings and 3D raymarching ingestion (requires 31 HTTP/disk reads per volume). |
| **Candidate 3: Sub-Volume Tile (16 z-levels)** | `(1, 16, 64, 64)` | 256.00 KB | 84 | 12 | Balanced 3D spatial partitioning; splits vertical column across 2 chunk boundaries, adding boundary stitching overhead for 31-level domain. |
| **Candidate 4: Brick-Aligned (32 z-levels)** | `(1, 32, 64, 64)` | 512.00 KB | 42 | 6 | Aligns with standard $32\times64\times64$ GPU brick geometry, but requires padding z-dimension beyond the native 31 levels. |
| **Candidate 5: Spatial 3D Column Tile (Selected)** | `(1, 31, 64, 64)` | **496.00 KB** | **42** | **6** | **Optimal Scientific Balance:** Retains complete vertical water column (all 31 levels) in a single chunk, while partitioning horizontally into $3\times2$ spatial tiles. |

### 4.2 Selection Justification: Candidate 5 `(1, 31, 64, 64)`
1. **Vertical Sounding & Profile Extraction:** Full-column vertical profiles ($z = 0\dots30$) at any lat/lon require opening exactly **1 chunk** (~496 KB uncompressed, ~120 KB zstd compressed).
2. **Horizontal ROI Slicing:** Browser clients fetching a sub-region only need to fetch the relevant 1 or 2 spatial tiles instead of the entire 2 MB dataset.
3. **TASK-04 Multiresolution Bricking:** Directly maps to spatial octree and brick subdivision with minimal transpose overhead.
4. **Network & Web Worker Overhead:** Chunk payload of ~120–200 KB compressed sits within the sweet spot for browser HTTP Range Requests and Web Worker decompression memory limits.

---

## 5. Codebase & Package Hygiene Check

- Verified `packages/contracts/` contains comprehensive Pydantic and JSON Schema contracts for canonical datasets (`canonical_dataset.py`, `variables.py`, `units.py`, `missing_values.py`, `provenance.py`).
- Confirmed no conflicting ingestion or duplicate processing frameworks exist in `packages/`.
- The subsequent task (TASK-03B) will implement the canonical adapter in `packages/ingestion/` utilizing the verified contracts and the chunking plan specified herein.

---

## 6. Preflight Conclusion & Next Actions

- **Task Status:** `TASK-03A COMPLETE — ADAPTER IMPLEMENTATION READY`
- **Blocking Issues:** None.
- **Handoff:** Ready for TASK-03B implementation of `CopernicusPhysicalAdapter` and canonical Zarr generation into `data/canonical/copernicus_phy_thetao/v1/`.
