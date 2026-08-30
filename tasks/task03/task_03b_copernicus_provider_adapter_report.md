# QuasarOS TASK-03B: Copernicus Physical Temperature Provider Adapter Report

> **Document Status:** COMPLETE — TASK-03B COPERNICUS PROVIDER ADAPTER  
> **Target Package:** `packages/ingestion/` (`quasar_ingestion.adapters.copernicus_phy_adapter`)  
> **Target Dataset:** Copernicus Marine Global Ocean Physics Analysis & Forecast (`GLOBAL_ANALYSISFORECAST_PHY_001_024`)  
> **Execution Date:** 2026-08-30  
> **Author:** Scientific Ingestion Engineer  
> **Next Pipeline Target:** TASK-03C Canonical Zarr Store Generation & TASK-04 Multiresolution Bricking  

---

## 1. Executive Summary & Deliverables Matrix

Under **TASK-03B**, the authoritative Copernicus Physical NetCDF provider adapter was developed, validated, and tested against both full raw assets (`data/raw/copernicus/physical/copernicus_phy_thetao_20250420_20250426.nc`) and validated fixtures (`tests/fixtures/real_data/copernicus_thetao_subvolume.nc`).

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║  TASK-03B PROVIDER ADAPTER DELIVERABLE MATRIX                                                    ║
║  Status:               TASK-03B COMPLETE — PROVIDER ADAPTER READY                                ║
║  Adapter Module:       packages/ingestion/src/quasar_ingestion/adapters/copernicus_phy_adapter.py ║
║  Contract Validation:  CanonicalDatasetContract (Zero Schema Drift Verified)                     ║
║  Source Verified:      data/raw/copernicus/physical/copernicus_phy_thetao_20250420_20250426.nc    ║
║  SHA-256 Checksum:     6b4ce3f47a77add27541ed836870dba9bcd6a2c34d258e6787a542e660627281 (MATCH) ║
║  Variable Mapped:      thetao -> sea_water_potential_temperature (PhysicalQuantity.temperature) ║
║  Canonical Units:      degree_Celsius (CF standard sea_water_potential_temperature)             ║
║  Array Decoding:       Lossless float32 array + companion uint8 validity mask (VALID / MISSING)   ║
║  Test Execution:       235/235 Unit Tests Passed (test_copernicus_phy_adapter.py included)      ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. Implementation Details

### 2.1 Package Scaffolding & Module Structure
Created the standalone `packages/ingestion/` workspace package adhering to repository architecture:
- `packages/ingestion/pyproject.toml`
- `packages/ingestion/src/quasar_ingestion/__init__.py`
- `packages/ingestion/src/quasar_ingestion/adapters/__init__.py`
- `packages/ingestion/src/quasar_ingestion/adapters/copernicus_phy_adapter.py`

### 2.2 Implemented Operations & Method Contracts
The `CopernicusPhysicalAdapter` implements all mandatory operations:

1. **`inspect_source_metadata()`**:
   - Extracts complete NetCDF data model (`NETCDF4`), dimension dictionary (`time: 7`, `depth: 31`, `latitude: 181`, `longitude: 97`), variable shapes, dtypes, and global attributes.
   - Cleans numpy scalar and array attributes for pure JSON-serializable output.

2. **`verify_source_integrity(expected_sha256: str)`**:
   - Performs streaming bitwise SHA-256 computation over the raw asset.
   - Asserts exact equality with expected hash and raises `ValueError` on checksum mismatch.

3. **`get_canonical_dataset_contract(...)`**:
   - Returns a fully validated `CanonicalDatasetContract` model.
   - **`DatasetIdentity`**: Certified under dataset ID `copernicus_phy_thetao`, product `GLOBAL_ANALYSISFORECAST_PHY_001_024`, role `ScientificRole.MODEL`, data class `DataClassDiscriminator.model_volume`.
   - **`HorizontalGridContract`**: Rectilinear equirectangular grid covering `[-3.0°N, 12.0°N]` $\times$ `[80.0°E, 88.0°E]` at $0.08333^\circ$ resolution with shape `[181, 97]`.
   - **`VerticalCoordinateContract`**: Discrete standard z-levels (`VerticalCoordinateType.z_level`) preserving 31 non-uniform levels ($0.494\text{ m} \to 453.938\text{ m}$) with datum `VerticalDatum.sea_surface`.
   - **`TimeSemanticsContract`**: Gregorian calendar daily timesteps with ISO-8601 UTC bounds `2025-04-20T00:00:00Z` to `2025-04-26T00:00:00Z`.
   - **`CanonicalVariableContract`**: Preserves `thetao` as `sea_water_potential_temperature`, `degree_Celsius`, `Topology.volume_scalar`, and `DisplayRange(8.0, 32.0, 'turbo', '°C')`.
   - **`DatasetCapabilitiesContract`**: Declares `can_volume_render_3d=True`, `can_exact_query=True`, `can_horizontal_slice=True`, `can_vertical_slice=True`, `can_extract_isosurface=True`.
   - **`ImmutableSourceAsset` & `LineageRecord`**: Captures bitwise source hash, retrieval timestamp, operator, and transformation provenance.

4. **`read_coordinates()`**:
   - Extracts monotonic coordinates: `depth` (31 levels), `latitude` (181 points), `longitude` (97 points).
   - Decodes time coordinates into ISO-8601 UTC timestamps (`2025-04-20T00:00:00Z` through `2025-04-26T00:00:00Z`).

5. **`read_variable_array(time_idx=None, depth_idx=None, lat_slice=None, lon_slice=None)`**:
   - Supports bounded slicing across 4 dimensions.
   - Returns decoupled `(decoded_values: float32 ndarray, validity_mask: uint8 ndarray)`.
   - Missing data (due to provider `_FillValue = 9.96921e+36` or land boundaries) are represented as IEEE 754 `NaN` in `decoded_values` and flag code `1` (`SOURCE_MISSING`) in `validity_mask`.
   - **Valid Zero Preservation:** Legitimate physical zeroes ($0.0^\circ\text{C}$) are retained as finite numeric `0.0` with `mask = 0` (`VALID`).

6. **`get_provenance_record(...)`**:
   - Returns an immutable `LineageRecord` capturing SHA-256 hash, execution timestamp, Python version, NetCDF4 version, and numpy version.

7. **`close()` / Context Manager**:
   - Ensures deterministic closing of open file handles via `__enter__` and `__exit__`.

---

## 3. Test Suite Verification

A dedicated test suite `tests/test_copernicus_phy_adapter.py` was created and run across the test runner:

| Test Case | Scope | Status |
|---|---|---|
| `test_raw_source_inspection_and_sha256_verification` | Dimension parsing, file model, SHA-256 match, tampered hash rejection | **PASSED** |
| `test_nonexistent_file_rejection` | Missing file safety | **PASSED** |
| `test_canonical_dataset_contract_generation` | Contract generation, identity, variable mapping, capabilities | **PASSED** |
| `test_coordinate_arrays_and_monotonicity` | Monotonicity check on depth, lat, lon, ISO-8601 UTC decoding | **PASSED** |
| `test_bounded_slice_reading_and_validity_masking` | Sliced read, companion mask, NaN verification | **PASSED** |
| `test_full_volume_reading_and_statistics` | All 3,809,869 voxels evaluated; 3,618,944 valid (94.99%), 190,925 masked (5.01%) | **PASSED** |
| `test_fixture_subvolume_execution` | Test against TASK-02 fixture `copernicus_thetao_subvolume.nc` | **PASSED** |

### Test Suite Execution Output
```
Ran 235 tests in 13.661s
OK (235 passed, 0 failures, 0 errors)
```

### Schema Drift Check
```
[*] Verifying JSON Schemas against Pydantic models in schemas/canonical...
[+] Zero schema drift detected. All schemas are 100% synchronized with Pydantic contracts.
```

---

## 4. Scientific Compliance & Governing Principles Checklist

- [x] **Read-Only Raw Assets:** `data/raw/**` was strictly accessed in read-only mode without in-place modification.
- [x] **Thermodynamic Nomenclature:** `thetao` preserved as `sea_water_potential_temperature` with `degree_Celsius`.
- [x] **Mask Separation:** Missing values are separated into companion `validity_mask` arrays and never silently mutated to `0.0`.
- [x] **Valid Zero Preservation:** Legitimate numeric zero values remain valid observations.
- [x] **Lossless Coordinate Extraction:** Monotonic coordinates and 31 non-uniform vertical z-levels are preserved without interpolation.
- [x] **Lineage & Provenance:** Full SHA-256 tracking and `LineageRecord` generation implemented.
- [x] **Scope Discipline:** No Zarr creation or rendering brick generation was performed in this task.

---

## 5. Handoff to Next Tasks

1. **Handoff Target:** TASK-03C (Copernicus Physical Temperature Canonical Zarr Store Writer) & TASK-04 (Multiresolution GPU Bricking).
2. **Readiness:** `CopernicusPhysicalAdapter` is certified and ready for ingestion pipeline consumption.
