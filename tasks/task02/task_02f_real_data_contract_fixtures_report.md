# TASK-02F Completion Report: Real-Data Contract Fixtures & Provenance

**Execution Date:** 2026-08-30  
**Specialist Role:** Scientific Test Data and Provenance Specialist  
**Status:** COMPLETED (100% Deterministic Extraction, 100% Tests Passing)

---

## 1. Executive Summary

TASK-02F established the authoritative suite of 8 compact, deterministic, real-data contract fixtures extracted directly from operational oceanographic datasets acquired during TASK-01 and TASK-01X. In accordance with governing principles (`AGENTS.md`):
- **0% synthetic or fabricated arrays**: All physical data arrays are sliced directly from genuine NetCDF assets.
- **Cryptographic Provenance**: Every fixture has a companion JSON manifest in `tests/fixtures/manifests/` detailing SHA-256 hashes, source asset lineage, spatial/temporal index slices, and open licences.
- **High Performance**: All 8 fixtures are strictly bounded (< 110 KB each, well within the 500 KB budget).
- **Parity & Validation**: An exhaustive verification suite in [`tests/test_real_data_fixtures.py`](file:///C:/Users/Ranji/Downloads/ocanscope3d/tests/test_real_data_fixtures.py) guarantees exact numerical equivalence against the raw source arrays and validates CF conventions, units, and vertical coordinate formulations.

---

## 2. Extracted Fixtures & Manifest Inventory

| # | Fixture Family | Source Asset | Target Fixture File | Size | Dimensions / Slices | Licence / Provenance |
|---|---|---|---|---|---|---|
| 1 | **Primary Scalar Volume** | `data/raw/copernicus/physical/copernicus_phy_thetao_20250420_20250426.nc` | [`copernicus_thetao_subvolume.nc`](file:///C:/Users/Ranji/Downloads/ocanscope3d/tests/fixtures/real_data/copernicus_thetao_subvolume.nc) | 49.21 KB | `(2, 5, 25, 25)`: 2 times, 5 depths (0.49–5.08m), lat [5.0, 7.0°N], lon [80.0, 82.0°E] | Copernicus Marine Open Licence (CC-BY-4.0 eq.) |
| 2 | **Secondary Scalar Volume** | `data/raw/hycom/hycom_espc_d_v02_temp3d_7day.nc` | [`hycom_water_temp_subvolume.nc`](file:///C:/Users/Ranji/Downloads/ocanscope3d/tests/fixtures/real_data/hycom_water_temp_subvolume.nc) | 32.26 KB | `(2, 6, 16, 16)`: 2 times, 6 depths (0–10m), 16x16 lat/lon grid | US Gov Public Domain |
| 3 | **Wave Grid** | `data/raw/copernicus/waves/copernicus_waves_20250420_20250426.nc` | [`copernicus_waves_subset.nc`](file:///C:/Users/Ranji/Downloads/ocanscope3d/tests/fixtures/real_data/copernicus_waves_subset.nc) | 57.29 KB | `(4, 20, 20)`: 4 timesteps, 20x20 lat/lon grid (`VHM0`, `VMDR`, `VTM02`, `VTPK`, `VPED`, `VHM0_WW`) | Copernicus Marine Open Licence (CC-BY-4.0 eq.) |
| 4 | **Profile Observation** | `data/raw/argo-gdac/D1902669_012.nc` | [`incois_argo_7902250_profile.nc`](file:///C:/Users/Ranji/Downloads/ocanscope3d/tests/fixtures/real_data/incois_argo_7902250_profile.nc) | 69.73 KB | `(1, 103)`: WMO 1902669 Cycle #12 with `PRES`, `TEMP`, `PSAL`, `PRES_QC`, `TEMP_QC`, `PSAL_QC`, and adjusted modes | Argo GDAC / Coriolis Open Policy |
| 5 | **Trajectory Observation** | `data/raw/gliders/ru29_20180812T0220_north_indian_ocean.nc` | [`ru29_glider_trajectory_subset.nc`](file:///C:/Users/Ranji/Downloads/ocanscope3d/tests/fixtures/real_data/ru29_glider_trajectory_subset.nc) | 107.74 KB | `(50,)`: 50 continuous trajectory waypoints traversing dive profiles 1 to 4 with physical parameters and QARTOD QC | CC-BY-4.0 / IOOS DAC Open Data |
| 6 | **Bathymetry Grid** | `data/raw/gebco/gebco-2026/gebco_2026_north_indian_ocean.nc` | [`gebco_2026_elevation_subset.nc`](file:///C:/Users/Ranji/Downloads/ocanscope3d/tests/fixtures/real_data/gebco_2026_elevation_subset.nc) | 23.98 KB | `(30, 30)`: 30x30 elevation grid, EPSG:4326 | GEBCO Open Data Licence |
| 7 | **Climatology Grid** | `data/raw/woa23/multivariable/woa23_august_salinity_north_indian_ocean.nc` & `woa23_august_oxygen_north_indian_ocean.nc` | [`woa23_salinity_oxygen_subset.nc`](file:///C:/Users/Ranji/Downloads/ocanscope3d/tests/fixtures/real_data/woa23_salinity_oxygen_subset.nc) | 36.84 KB | `(1, 5, 15, 15)`: Multivariable Salinity (`s_an`) & Oxygen (`o_an`) across 5 standard depths (0–20m) | NOAA Open Access Public Data |
| 8 | **ROMS S-Coordinate Metadata** | `data/raw/roms/incois_bio_roms_north_indian_ocean.nc` | [`incois_bioroms_metadata_subset.nc`](file:///C:/Users/Ranji/Downloads/ocanscope3d/tests/fixtures/real_data/incois_bioroms_metadata_subset.nc) | 30.69 KB | `(2, 20, 20)`: Surface physics (`temp`, `salt`, `pH`) + `s_rho` (32), `Cs_r` (32), `hc=100.0`, `Vtransform=2`, `Vstretching=4` | CC-BY-4.0 (Zenodo: 10.5281/zenodo.11670413) |

---

## 3. Extraction Script & Companion Manifests

1. **Extraction Tool:** [`scripts/extract_real_fixtures.py`](file:///C:/Users/Ranji/Downloads/ocanscope3d/scripts/extract_real_fixtures.py)
   - Employs `netCDF4` and `numpy` to copy global attributes, coordinates, datatypes, and data slices.
   - Preserves CF fill values and metadata attributes without mutating underlying scientific variables.
   - Automatically generates the companion manifests in [`tests/fixtures/manifests/`](file:///C:/Users/Ranji/Downloads/ocanscope3d/tests/fixtures/manifests/).

2. **Manifest Schema Features:**
   - `fixture_id` & `fixture_filename`
   - `source_asset`: relative path, source SHA-256 hash, byte size, provider, product ID, and licence attribution.
   - `extraction_spec`: exact extraction command, spatial/temporal bounding boxes and index slices, variable inventory, target shape.
   - `fixture_artifact`: computed fixture SHA-256 hash, byte size, and UTC timestamp.

---

## 4. Test Verification Results

The test suite [`tests/test_real_data_fixtures.py`](file:///C:/Users/Ranji/Downloads/ocanscope3d/tests/test_real_data_fixtures.py) was executed alongside the entire repository test suite:

```bash
# Specific TASK-02F verification
python -m unittest tests/test_real_data_fixtures.py
# Ran 11 tests in 1.273s -> OK

# Full regression discovery
python -m unittest discover tests
# Ran 201 tests in 17.800s -> OK
```

### Verified Properties:
1. **Fixture & Manifest Existence**: All 8 fixtures and 8 manifests are present and within the < 500 KB budget.
2. **Cryptographic Checksums**: 100% match between on-disk NetCDF files, source files, and JSON manifest hashes.
3. **Exact Array Equality**: `numpy.testing.assert_array_equal` asserts zero numeric difference between extracted subvolumes and raw datasets in `data/raw/`.
4. **CF Variable & Coordinate Integrity**: Preserved units (`degrees_C`, `degC`, `m`, `degrees_north`, `degrees_east`, etc.), dimensions, standard names, and valid min/max ranges.
5. **ROMS S-Coordinate Formula Integrity**: `s_rho` and `Cs_r` vertical stretch functions strictly monotonic in `[-1, 0]`.

---

## 5. Artifacts Created & Modified

- **Extraction Script**: [`scripts/extract_real_fixtures.py`](file:///C:/Users/Ranji/Downloads/ocanscope3d/scripts/extract_real_fixtures.py)
- **Extracted NetCDF Fixtures**:
  - `tests/fixtures/real_data/copernicus_thetao_subvolume.nc`
  - `tests/fixtures/real_data/hycom_water_temp_subvolume.nc`
  - `tests/fixtures/real_data/copernicus_waves_subset.nc`
  - `tests/fixtures/real_data/incois_argo_7902250_profile.nc`
  - `tests/fixtures/real_data/ru29_glider_trajectory_subset.nc`
  - `tests/fixtures/real_data/gebco_2026_elevation_subset.nc`
  - `tests/fixtures/real_data/woa23_salinity_oxygen_subset.nc`
  - `tests/fixtures/real_data/incois_bioroms_metadata_subset.nc`
- **Companion JSON Manifests**:
  - `tests/fixtures/manifests/copernicus_thetao_subvolume_manifest.json`
  - `tests/fixtures/manifests/hycom_water_temp_subvolume_manifest.json`
  - `tests/fixtures/manifests/copernicus_waves_subset_manifest.json`
  - `tests/fixtures/manifests/incois_argo_7902250_profile_manifest.json`
  - `tests/fixtures/manifests/ru29_glider_trajectory_subset_manifest.json`
  - `tests/fixtures/manifests/gebco_2026_elevation_subset_manifest.json`
  - `tests/fixtures/manifests/woa23_salinity_oxygen_subset_manifest.json`
  - `tests/fixtures/manifests/incois_bioroms_metadata_subset_manifest.json`
- **Unit Test Suite**: [`tests/test_real_data_fixtures.py`](file:///C:/Users/Ranji/Downloads/ocanscope3d/tests/test_real_data_fixtures.py)
- **Task Report**: `task_02f_real_data_contract_fixtures_report.md`
