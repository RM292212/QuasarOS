# TASK-05C Completion Report: Authoritative Exact-Value Query Engine and API

**Task Identifier:** TASK-05C  
**Task Title:** Authoritative Exact-Value Query Engine and API  
**Status:** COMPLETE — AUTHORITATIVE QUERY SERVICE VALIDATED  
**Timestamp UTC:** 2026-08-30T14:55:00Z  
**Primary Assets Evaluated:**
- Raw Native NetCDF-4 Source: `data/raw/copernicus/physical/copernicus-phy-thetao-20260824-20260830-ca826087/copernicus_phy_thetao_20260824_20260830.nc`
- SHA-256 Digest: `ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c`
- Canonical Dataset ID: `copernicus_phy_thetao`
- Active Snapshot ID: `copernicus-phy-thetao-20260824-20260830-ca826087`

---

## 1. Summary of Implementation

TASK-05C delivers the authoritative scientific exact-value query engine, vertical profile extraction service, and provisional GPU raycast pick reconciliation engine within `packages/services/src/quasar_services/query/`.

### Core Architectural Invariants Delivered:
1. **Sole Scientific Authority (ADR-0005):**
   - The query engine reads directly and solely from the immutable native NetCDF-4 source file (`copernicus_phy_thetao_20260824_20260830.nc`).
   - Strict file-open auditing proves that the engine **NEVER** opens, decompresses, or samples Float16 / Uint16 visualization brick payloads (`.bin.zst`) to fulfill exact scientific queries.
2. **Coordinate & Depth Selection Algorithms:**
   - **Monotonic Depth LUT Search:** Binary search (`bisect_left` / minimal Euclidean distance) across 31 non-uniform depth levels ($0.494\,\text{m} \to 453.938\,\text{m}$). Supports `PHYSICAL_DEPTH_METERS`, `GRID_LEVEL_INDEX`, `SEA_SURFACE`, `SEA_FLOOR`, and `PRESSURE_DBAR` (via latitude-adjusted TEOS-10 hydrostatic gravity formulations).
   - **Geodetic Nearest-Neighbor & Haversine Distance:** Resolves sub-grid geodetic coordinates onto the regular $1/12^\circ$ horizontal grid ($[-3^\circ\text{N}, 12^\circ\text{N}] \times [80^\circ\text{E}, 88^\circ\text{E}]$) and computes precise horizontal delta distance in kilometers via the great-circle Haversine formula.
   - **Temporal Resolution:** Matches exact UTC timestamps against the 7 daily operational snapshots (`2026-08-24T00:00:00Z` through `2026-08-30T00:00:00Z`) with configurable fallback to nearest available timesteps.
3. **Strict Missing-Value Policy:**
   - Missing values (`_FillValue: 9.96921e+36`, NaNs, land masks, and topography) are strictly preserved with `scientific_value = None` and typed `PhysicalCellState.masked` or `PhysicalCellState.missing`.
   - Missing/masked cells are **NEVER mutated to numeric physical $0.0\,^\circ\text{C}$**.
   - Valid oceanic $0.0\,^\circ\text{C}$ values are strictly distinguished from missing sentinels.
4. **Provisional Pick Reconciliation:**
   - Ingests `ProvisionalRenderPickResponse` containing approximate GPU texture values sampled from raymarching viewports.
   - Evaluates authoritative native NetCDF ground truth at the corresponding raycast coordinates.
   - Returns `ReconcilePickResponse` containing the full authoritative `ExactValueQueryResponse`, empirical `absolute_difference_delta`, `relative_difference_percent`, and an evaluation of whether the error is strictly within `estimated_sample_error_bound`.
5. **High-Performance In-Memory LRU Caching & Thread Safety:**
   - Built-in thread-safe LRU query cache ensuring sub-millisecond warmed response times:
     - Point query warmed p95 latency: **$< 0.05\,\text{ms}$** (Target $< 50\,\text{ms}$).
     - Vertical profile query warmed p95 latency: **$< 0.10\,\text{ms}$** (Target $< 150\,\text{ms}$).

---

## 2. Files Created and Modified

### Created Files:
- `packages/services/src/quasar_services/query/__init__.py`: Export definitions for coordinate resolvers, query engines, domain exceptions, and models.
- `packages/services/src/quasar_services/query/errors.py`: Query domain exceptions mapped to `docs/02-architecture/ErrorModel.md` (`VALIDATION_OUT_OF_BOUNDS`, `DATA_VARIABLE_NOT_FOUND`, `VALIDATION_UNSUPPORTED_METHOD`, `DATA_PROCESSING_ERROR`).
- `packages/services/src/quasar_services/query/models.py`: Pydantic V2 models for vertical profile requests/responses, level samples, and pick reconciliation contracts.
- `packages/services/src/quasar_services/query/coordinate_resolver.py`: 31-level depth LUT binary search, geodetic grid index mapping, Haversine distance, TEOS-10 pressure-depth conversion, and temporal index resolution.
- `packages/services/src/quasar_services/query/cache.py`: Thread-safe LRU query cache with hit/miss statistics.
- `packages/services/src/quasar_services/query/query_engine.py`: Core authoritative NetCDF-4 extraction engine with thread-safe read locks, unit conversion, and missing value guards.
- `packages/services/src/quasar_services/query/router.py`: FastAPI endpoints mounted under `/api/v1/queries/`.
- `tests/test_exact_query_service.py`: Automated unit, integration, failure-injection, performance, and brick-isolation test suite.
- `task_05c_authoritative_exact_value_query_service_report.md`: Completion report.

### Modified Files:
- `packages/services/src/quasar_services/app.py`: Mounted `query_router` under `/api/v1/queries/` and unified domain exception handling.

---

## 3. Public Interfaces & Endpoints Added

| Method | Endpoint | Request Model | Response Model | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/queries/value` | `ExactValueQueryRequest` | `ApiResponse[ExactValueQueryResponse]` | Authoritative point query evaluating native NetCDF truth |
| `POST` | `/api/v1/queries/profile` | `VerticalProfileQueryRequest` | `ApiResponse[VerticalProfileQueryResponse]` | Full 1D column extraction across all 31 vertical levels |
| `POST` | `/api/v1/queries/reconcile-pick` | `ReconcilePickRequest` | `ApiResponse[ReconcilePickResponse]` | Reconciles provisional GPU raymarch pick against native NetCDF truth |

---

## 4. Test Execution & Evidence

### Test Suite: `tests/test_exact_query_service.py`
```
Ran 9 tests in 0.150s:
- test_exact_point_query_surface_thermocline_deep: PASSED
- test_geodetic_nearest_neighbor_resolution: PASSED
- test_missing_value_preservation_on_land: PASSED
- test_out_of_bounds_spatial_and_depth_rejection: PASSED
- test_provisional_render_pick_reconciliation: PASSED
- test_query_engine_never_opens_visualization_bricks: PASSED
- test_query_performance_benchmarks: PASSED
- test_unit_conversion_kelvin_and_fahrenheit: PASSED
- test_vertical_profile_query_all_31_levels: PASSED
```

### Full Repository Regression Run:
```
Ran 307 tests in 138.751s across all packages (contracts, ingestion, processing, catalog, query):
OK — Zero regressions across all 307 tests.
```

---

## 5. Performance Measurements

| Metric | Measured Median | Measured p95 | Target Budget | Result |
|---|---|---|---|---|
| Cold Point Query | 0.435 ms | 0.850 ms | $< 50\,\text{ms}$ | PASS |
| Warmed Point Query | 0.012 ms | 0.045 ms | $< 50\,\text{ms}$ | PASS |
| Cold Vertical Profile (31 levels) | 1.186 ms | 1.950 ms | $< 150\,\text{ms}$ | PASS |
| Warmed Vertical Profile (31 levels) | 0.025 ms | 0.090 ms | $< 150\,\text{ms}$ | PASS |

---

## 6. Handoff & Next Phase

With TASK-05C complete, the query engine is fully integrated with the catalog service (TASK-05B) and ready for TASK-05D (End-to-End Integration & Conformance Validation).
