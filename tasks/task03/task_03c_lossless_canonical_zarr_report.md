# QuasarOS TASK-03C: Lossless Canonical Zarr Writer & Store Generation Report

> **Document Status:** COMPLETE — TASK-03C CANONICAL ZARR READY  
> **Target Package:** `packages/ingestion/` (`quasar_ingestion.storage.canonical_zarr_writer`)  
> **Target Dataset:** Copernicus Marine Global Ocean Physics Analysis & Forecast (`GLOBAL_ANALYSISFORECAST_PHY_001_024`)  
> **Target Store Destination:** `data/canonical/copernicus_phy_thetao/v1/`  
> **Target Manifests:** `data/canonical/copernicus_phy_thetao/v1/canonical_manifest.json` and `data/manifests/canonical/copernicus_phy_thetao_manifest.json`  
> **Execution Date:** 2026-08-30  
> **Author:** Scientific Storage Pipeline Engineer  
> **Next Pipeline Target:** TASK-04 (Multiresolution GPU Bricking & LOD Hierarchy)  

---

## 1. Executive Summary & Deliverables Matrix

Under **TASK-03C**, the lossless canonical Zarr storage pipeline was implemented, validated, and executed against authoritative Copernicus Marine physical potential temperature data (`data/raw/copernicus/physical/copernicus_phy_thetao_20250420_20250426.nc`).

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║  TASK-03C LOSSLESS CANONICAL ZARR DELIVERABLE MATRIX                                             ║
║  Status:               TASK-03C COMPLETE — CANONICAL ZARR READY                                  ║
║  Writer Module:        packages/ingestion/src/quasar_ingestion/storage/canonical_zarr_writer.py    ║
║  CLI Tool:             scripts/build_canonical_zarr.py                                           ║
║  Published Store:      data/canonical/copernicus_phy_thetao/v1/                                  ║
║  Consolidated Meta:    data/canonical/copernicus_phy_thetao/v1/.zmetadata (Verified)             ║
║  Primary Manifest:     data/canonical/copernicus_phy_thetao/v1/canonical_manifest.json           ║
║  Companion Manifest:   data/manifests/canonical/copernicus_phy_thetao_manifest.json              ║
║  Source Verified:      data/raw/copernicus/physical/copernicus_phy_thetao_20250420_20250426.nc    ║
║  Source SHA-256:       6b4ce3f47a77add27541ed836870dba9bcd6a2c34d258e6787a542e660627281 (MATCH) ║
║  Volumetric Array:     sea_water_potential_temperature: float32, (7, 31, 181, 97), (1,31,64,64)  ║
║  Validity Mask Array:  validity_mask: uint8, (7, 31, 181, 97), (1,31,64,64)                      ║
║  Numerical Tolerance:  0.000000 max absolute difference vs decoded NetCDF arrays (Exact Lossless)║
║  Valid Zero Integrity: 0.0 °C preserved without NaN corruption                                   ║
║  Compression Codec:    Zstandard (zstd level 3)                                                  ║
║  Atomic Staging:       Temporary staging + rename swap (Zero partial writes)                     ║
║  Idempotency Check:    Checksum and manifest verification before write                           ║
║  Test Execution:       238/238 Unit Tests Passed (test_canonical_zarr_writer.py included)        ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. Implementation Architecture

### 2.1 Storage Package Structure
The storage subsystem was created within `packages/ingestion/`:
- `packages/ingestion/src/quasar_ingestion/storage/__init__.py`: Public exports for `LosslessCanonicalZarrWriter`, `CanonicalZarrManifest`, `ArrayManifest`, and `ChunkRecord`.
- `packages/ingestion/src/quasar_ingestion/storage/canonical_zarr_writer.py`: Authoritative implementation of the lossless canonical Zarr store builder and validator.
- `scripts/build_canonical_zarr.py`: Production CLI with idempotency, source verification, and manifest generation flags (`--source`, `--output-dir`, `--expected-sha256`, `--force`, `--verify`).

### 2.2 Array Layout, Chunk Geometry & Codec Configuration

The published Zarr v2 root group contains the following canonical arrays:

| Array Name | Shape | Chunks | Dtype | Fill Value | Codec | Standard Name / Units |
|---|---|---|---|---|---|---|
| `sea_water_potential_temperature` | `(7, 31, 181, 97)` | `(1, 31, 64, 64)` | `float32` | `NaN` | `zstd(level=3)` | `sea_water_potential_temperature` (`degree_Celsius`) |
| `validity_mask` | `(7, 31, 181, 97)` | `(1, 31, 64, 64)` | `uint8` | `1` (`SOURCE_MISSING`) | `zstd(level=3)` | `status_flag` (Categorical Codes 0-8) |
| `depth` | `(31,)` | `(31,)` | `float32` | `None` | `zstd(level=3)` | `depth` (`m`, positive down) |
| `latitude` | `(181,)` | `(181,)` | `float32` | `None` | `zstd(level=3)` | `latitude` (`degrees_north`, `[-3.0, 12.0]`) |
| `longitude` | `(97,)` | `(97,)` | `float32` | `None` | `zstd(level=3)` | `longitude` (`degrees_east`, `[80.0, 88.0]`) |
| `time` | `(7,)` | `(7,)` | `float32` | `None` | `zstd(level=3)` | `time` (`hours since 1950-01-01`) |
| `time_iso` | `(7,)` | `(7,)` | `<U20` | `None` | `zstd(level=3)` | `time` (`ISO-8601 UTC`, `2025-04-20T00:00:00Z` to `2025-04-26T00:00:00Z`) |

### 2.3 Chunk Indexing & Geometry Details
For 4D spatial grids of dimension `(7, 31, 181, 97)` with chunks `(1, 31, 64, 64)`:
- Dimension $T$ (Time, 7 steps): 7 chunks of size 1.
- Dimension $Z$ (Depth, 31 levels): 1 chunk of size 31.
- Dimension $Y$ (Latitude, 181 points): $\lceil 181 / 64 \rceil = 3$ chunks.
- Dimension $X$ (Longitude, 97 points): $\lceil 97 / 64 \rceil = 2$ chunks.
- **Total chunk files generated per 4D array:** $7 \times 1 \times 3 \times 2 = 42$ individual chunks.
- Total chunk manifest records stored with individual file sizes and SHA-256 digests: 42 chunks for `sea_water_potential_temperature` + 42 chunks for `validity_mask` + 5 coordinate chunks = 89 cryptographic chunk records.

### 2.4 Consolidated Metadata (`.zmetadata`)
The root group metadata is consolidated into `.zmetadata` conforming to the Zarr v2 consolidated metadata specification. Browsers and FastAPI endpoints can load all array shapes, chunk geometries, codecs, and root attributes (`CanonicalDatasetContract` JSON) in a single HTTP request without multiple filesystem or S3 roundtrips.

---

## 3. Scientific Verification & Numerical Losslessness

### 3.1 0.000000 Absolute Numerical Error
The output array values were checked voxel-for-voxel against the raw decoded NetCDF arrays:
- Total voxels: 3,809,869
- Valid physical voxels: 3,618,944 (94.99%)
- Masked voxels: 190,925 (5.01%)
- **Max Absolute Error:** `0.0000000000e+00`
- **Max Relative Error:** `0.0000000000e+00`
- **Differing valid samples:** `0`
- **Differing NaN/mask locations:** `0`

### 3.2 Valid Zero Preservation
Physical zero values ($0.0^\circ\text{C}$) are retained as finite IEEE 754 numeric values with `validity_mask == 0` (`VALID`). Missing values and land boundaries are encoded as IEEE 754 `NaN` with `validity_mask == 1` (`SOURCE_MISSING`), satisfying ADR-0005, AGENTS.md, and `docs/03-science-data/MissingDataAndMasks.md`.

---

## 4. Atomic Staging & Publication Workflow

To prevent partial or corrupted stores from being read during generation:
1. Data and metadata are written into a temporary staging directory on the same filesystem (`data/canonical/copernicus_phy_thetao/.tmp_zarr_XXXXXX/`).
2. `.zmetadata` is consolidated in staging.
3. Cryptographic chunk and array buffer digests are computed and compiled into `canonical_manifest.json`.
4. Automated verification re-opens the staged store via `zarr.open_consolidated()` and compares all coordinates, arrays, and masks against the source adapter.
5. If and only if verification passes with 0.0 error, the staging directory is atomically renamed to the target publication directory (`data/canonical/copernicus_phy_thetao/v1/`).
6. Companion manifest copy is written to `data/manifests/canonical/copernicus_phy_thetao_manifest.json`.

---

## 5. Test Suite Execution & Idempotency Verification

The test suite `tests/test_canonical_zarr_writer.py` was executed alongside the full repository test suite:

```
Ran 238 tests in 19.868s
OK (238 passed, 0 failures, 0 errors)
```

| Test Case | Scope | Status |
|---|---|---|
| `test_fixture_zarr_generation_and_numerical_losslessness` | Validates fixture Zarr creation, consolidated metadata, and exact 0.0 numerical tolerance against subvolume | **PASSED** |
| `test_raw_netcdf_zarr_generation_and_chunk_geometry` | Validates full raw volume conversion, 42-chunk geometry, and validity mask distribution | **PASSED** |
| `test_idempotency_behavior` | Verifies that repeat executions detect existing valid stores and skip unnecessary writes | **PASSED** |

### Idempotency CLI Execution Test
```bash
$ python scripts/build_canonical_zarr.py
2026-08-30 15:39:53,404 [INFO] build_canonical_zarr: Starting Canonical Zarr Writer Pipeline...
2026-08-30 15:39:53,424 [INFO] build_canonical_zarr: Idempotency match: Canonical Zarr store at data/canonical/copernicus_phy_thetao/v1 is already up-to-date and validated. No work needed.
```

---

## 6. Scientific Compliance Checklist

- [x] **Strict Read-Only Source Data:** `data/raw/**` was accessed strictly read-only.
- [x] **Lossless Float32 Fidelity:** Exact 0.0 error bounds verified against source NetCDF.
- [x] **No LOD/Halo Pollution:** No LODs, halos, or transfer-function masks generated (reserved for TASK-04).
- [x] **Categorical Mask Separation:** Missing values separated into `validity_mask` (uint8) rather than zero mutations.
- [x] **Valid Zero Preservation:** $0.0^\circ\text{C}$ maintained as finite valid numbers.
- [x] **Zarr v2 Consolidated Metadata:** `.zmetadata` present and validated for fast client/browser loading.
- [x] **Atomic Publication:** Temporary staging directory rename workflow enforced.
- [x] **Cryptographic Manifest:** SHA-256 per chunk and array buffer recorded in canonical manifest.

---

## 7. Handoff to Next Pipeline Stage

1. **Handoff Target:** TASK-04 (Multiresolution Volume Bricking & LOD Hierarchy Generation).
2. **Canonical Store Endpoint:** `data/canonical/copernicus_phy_thetao/v1/`
3. **Status:** Certified and ready for downstream processing.
