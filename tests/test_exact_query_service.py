"""
tests/test_exact_query_service.py — Unit & Integration Test Suite for TASK-05C.

Verifies:
1. Exact point query at known oceanic coordinates (surface, thermocline, depth).
2. Vertical profile retrieval across all 31 depth levels.
3. Nearest-neighbor coordinate resolution with correct geodetic Haversine distance metrics.
4. Strict missing-value preservation on land/missing cells (zero physical 0.0 deg C mutations).
5. Out-of-bounds spatial, depth, and temporal query rejection with structured error envelopes.
6. Provisional GPU render pick reconciliation computing exact numerical difference deltas.
7. Strict assertion proving query engine NEVER opens .bin.zst visualization brick payloads.
8. Performance benchmarks: Warmed point query p95 < 50ms, vertical profile query p95 < 150ms.
"""

from builtins import open as builtin_open
import math
import os
import pathlib
import sys
import time
import unittest
from fastapi.testclient import TestClient
import netCDF4
import numpy as np

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
SERVICES_SRC = REPO_ROOT / "packages" / "services" / "src"

if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))
if str(SERVICES_SRC) not in sys.path:
    sys.path.insert(0, str(SERVICES_SRC))

from quasar_contracts.exact_value_contracts import (
    ExactValueQueryRequest,
    ExactValueQueryResponse,
    ProvisionalRenderPickResponse,
    SelectionInterpolationContract,
    SelectionMethod,
    TimeSelectorMode,
    VerticalSelectorType,
)
from quasar_contracts.missing_values import PhysicalCellState
from quasar_services.app import app
from quasar_services.query import (
    CoordinateOutOfBoundsException,
    CoordinateResolver,
    DEPTH_LUT_METERS,
    DepthOutOfBoundsException,
    ExactQueryEngine,
    QueryServiceException,
    ReconcilePickRequest,
    ReconcilePickResponse,
    TemporalOutOfBoundsException,
    VariableNotFoundException,
    VerticalProfileQueryRequest,
    VerticalProfileQueryResponse,
    get_query_engine,
    haversine_distance_km,
)


class TestExactQueryService(unittest.TestCase):
    """Scientific exact-value query engine unit & integration tests."""

    @classmethod
    def setUpClass(cls):
        cls.engine = ExactQueryEngine(repo_root=REPO_ROOT)
        cls.client = TestClient(app)

        # Open reference NetCDF for ground truth checks
        cls.raw_nc_path = (
            REPO_ROOT
            / "data"
            / "raw"
            / "copernicus"
            / "physical"
            / "copernicus-phy-thetao-20260824-20260830-ca826087"
            / "copernicus_phy_thetao_20260824_20260830.nc"
        )
        cls.ref_ds = netCDF4.Dataset(str(cls.raw_nc_path), mode="r")
        cls.ref_thetao = cls.ref_ds.variables["thetao"]

    @classmethod
    def tearDownClass(cls):
        cls.engine.close()
        cls.ref_ds.close()

    # =========================================================================
    # 1. Authoritative Exact Point Queries & Depth Selection
    # =========================================================================
    def test_exact_point_query_surface_thermocline_deep(self):
        """Test point queries at sea surface, thermocline, and deep layer matching native NetCDF truth."""
        test_cases = [
            # (name, lat, lon, selector_type, target_value, expected_depth_idx)
            ("sea_surface", 4.0, 84.0, VerticalSelectorType.SEA_SURFACE, 0.0, 0),
            ("thermocline_55m", 4.0, 84.0, VerticalSelectorType.PHYSICAL_DEPTH_METERS, 55.0, 18),
            ("thermocline_109m", 4.0, 84.0, VerticalSelectorType.PHYSICAL_DEPTH_METERS, 109.73, 22),
            ("sea_floor", 4.0, 84.0, VerticalSelectorType.SEA_FLOOR, 0.0, 30),
            ("grid_level_index_10", 4.0, 84.0, VerticalSelectorType.GRID_LEVEL_INDEX, 10, 10),
            ("pressure_50dbar", 4.0, 84.0, VerticalSelectorType.PRESSURE_DBAR, 50.0, 17),
        ]

        for name, lat, lon, selector, target_val, exp_depth_idx in test_cases:
            with self.subTest(case=name):
                req = ExactValueQueryRequest(
                    dataset_id="copernicus_phy_thetao",
                    variable_id="sea_water_potential_temperature",
                    latitude_deg=lat,
                    longitude_deg=lon,
                    vertical_selector_type=selector,
                    vertical_target_value=target_val,
                    target_time_utc="2026-08-30T00:00:00Z",
                )

                resp = self.engine.execute_exact_point_query(req)
                self.assertEqual(resp.response_type, "authoritative_scientific_value")
                self.assertEqual(resp.value_state, PhysicalCellState.valid)
                self.assertIsNotNone(resp.scientific_value)

                # Ground truth comparison from direct NetCDF
                time_idx = 6  # 2026-08-30
                lat_idx = resp.grid_index_evaluated[2]
                lon_idx = resp.grid_index_evaluated[3]
                depth_idx = resp.grid_index_evaluated[1]

                self.assertEqual(depth_idx, exp_depth_idx)
                expected_raw = float(self.ref_thetao[time_idx, depth_idx, lat_idx, lon_idx])
                self.assertAlmostEqual(resp.scientific_value, expected_raw, places=4)
                self.assertEqual(resp.canonical_units, "degree_Celsius")
                self.assertEqual(resp.source_asset_id, "copernicus_phy_thetao_20260824_20260830.nc")
                self.assertEqual(
                    resp.source_asset_sha256,
                    "ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c",
                )

    def test_unit_conversion_kelvin_and_fahrenheit(self):
        """Verify scientific unit conversion to Kelvin and Fahrenheit preserves precision."""
        req_celsius = ExactValueQueryRequest(
            dataset_id="copernicus_phy_thetao",
            variable_id="sea_water_potential_temperature",
            latitude_deg=4.0,
            longitude_deg=84.0,
            vertical_target_value=0.494,
            requested_units="degC",
        )
        resp_c = self.engine.execute_exact_point_query(req_celsius)

        # Kelvin
        req_k = ExactValueQueryRequest(
            dataset_id="copernicus_phy_thetao",
            variable_id="sea_water_potential_temperature",
            latitude_deg=4.0,
            longitude_deg=84.0,
            vertical_target_value=0.494,
            requested_units="kelvin",
        )
        resp_k = self.engine.execute_exact_point_query(req_k)
        self.assertEqual(resp_k.canonical_units, "kelvin")
        self.assertAlmostEqual(resp_k.scientific_value, resp_c.scientific_value + 273.15, places=4)

        # Fahrenheit
        req_f = ExactValueQueryRequest(
            dataset_id="copernicus_phy_thetao",
            variable_id="sea_water_potential_temperature",
            latitude_deg=4.0,
            longitude_deg=84.0,
            vertical_target_value=0.494,
            requested_units="fahrenheit",
        )
        resp_f = self.engine.execute_exact_point_query(req_f)
        self.assertEqual(resp_f.canonical_units, "fahrenheit")
        self.assertAlmostEqual(resp_f.scientific_value, resp_c.scientific_value * 1.8 + 32.0, places=4)

    # =========================================================================
    # 2. Vertical Profile Column Cast Queries
    # =========================================================================
    def test_vertical_profile_query_all_31_levels(self):
        """Test vertical profile extraction across all 31 depth levels."""
        req = VerticalProfileQueryRequest(
            dataset_id="copernicus_phy_thetao",
            variable_id="sea_water_potential_temperature",
            latitude_deg=2.0,
            longitude_deg=85.0,
            target_time_utc="2026-08-30T00:00:00Z",
        )

        resp = self.engine.execute_vertical_profile_query(req)
        self.assertEqual(resp.response_type, "authoritative_vertical_profile")
        self.assertEqual(resp.total_levels, 31)
        self.assertEqual(len(resp.samples), 31)
        self.assertEqual(resp.valid_levels_count, 31)

        # Verify monotonicity of depth levels
        for k in range(30):
            self.assertLess(resp.samples[k].depth_m, resp.samples[k + 1].depth_m)

        # Verify values match native column
        time_idx = 6
        lat_idx = resp.grid_index_evaluated[1]
        lon_idx = resp.grid_index_evaluated[2]
        native_col = self.ref_thetao[time_idx, :, lat_idx, lon_idx]

        for k in range(31):
            expected_val = float(native_col[k])
            self.assertEqual(resp.samples[k].level_index, k)
            self.assertEqual(resp.samples[k].value_state, PhysicalCellState.valid)
            self.assertAlmostEqual(resp.samples[k].scientific_value, expected_val, places=4)

    # =========================================================================
    # 3. Nearest-Neighbor Resolution & Geodetic Distance Metrics
    # =========================================================================
    def test_geodetic_nearest_neighbor_resolution(self):
        """Verify sub-grid coordinates resolve to nearest node with correct Haversine distance."""
        req_lat = 4.1234
        req_lon = 84.5678

        req = ExactValueQueryRequest(
            dataset_id="copernicus_phy_thetao",
            variable_id="sea_water_potential_temperature",
            latitude_deg=req_lat,
            longitude_deg=req_lon,
            vertical_target_value=10.0,
        )

        resp = self.engine.execute_exact_point_query(req)
        self.assertEqual(resp.requested_latitude_deg, req_lat)
        self.assertEqual(resp.requested_longitude_deg, req_lon)

        # Recompute Haversine distance independently
        expected_dist = haversine_distance_km(req_lat, req_lon, resp.resolved_latitude_deg, resp.resolved_longitude_deg)
        provenance_dist = resp.provenance_details["horizontal_distance_delta_km"]
        self.assertAlmostEqual(provenance_dist, expected_dist, places=3)
        self.assertLess(expected_dist, 10.0)  # Max distance to nearest 1/12 deg node is ~6.5 km

    # =========================================================================
    # 4. Strict Missing-Value & Land Mask Preservation
    # =========================================================================
    def test_missing_value_preservation_on_land(self):
        """Querying land (Sri Lanka: 6.0N, 80.5E) must return scientific_value=None and state=masked."""
        req = ExactValueQueryRequest(
            dataset_id="copernicus_phy_thetao",
            variable_id="sea_water_potential_temperature",
            latitude_deg=6.0,
            longitude_deg=80.5,
            vertical_target_value=0.494,
        )

        resp = self.engine.execute_exact_point_query(req)
        self.assertIsNone(resp.scientific_value, "Land cell MUST have scientific_value = None")
        self.assertEqual(resp.value_state, PhysicalCellState.masked)
        self.assertNotEqual(resp.scientific_value, 0.0, "Missing cell MUST NEVER mutate to numeric 0.0")

        # Profile over land must retain masked state
        prof_req = VerticalProfileQueryRequest(
            dataset_id="copernicus_phy_thetao",
            variable_id="sea_water_potential_temperature",
            latitude_deg=6.0,
            longitude_deg=80.5,
        )
        prof_resp = self.engine.execute_vertical_profile_query(prof_req)
        self.assertIsNone(prof_resp.samples[0].scientific_value)
        self.assertEqual(prof_resp.samples[0].value_state, PhysicalCellState.masked)

    # =========================================================================
    # 5. Out-of-Bounds Rejection & Error Envelopes
    # =========================================================================
    def test_out_of_bounds_spatial_and_depth_rejection(self):
        """Verify out-of-bounds coordinates return structured 422 VALIDATION_OUT_OF_BOUNDS."""
        # 1. Latitude out of bounds
        r_lat = self.client.post(
            "/api/v1/queries/value",
            json={
                "dataset_id": "copernicus_phy_thetao",
                "variable_id": "sea_water_potential_temperature",
                "latitude_deg": 35.0,  # Valid domain is -3 to 12
                "longitude_deg": 84.0,
            },
        )
        self.assertEqual(r_lat.status_code, 422)
        err = r_lat.json()["error"]
        self.assertEqual(err["code"], "VALIDATION_OUT_OF_BOUNDS")
        self.assertFalse(err["retryable"])

        # 2. Longitude out of bounds
        r_lon = self.client.post(
            "/api/v1/queries/value",
            json={
                "dataset_id": "copernicus_phy_thetao",
                "variable_id": "sea_water_potential_temperature",
                "latitude_deg": 4.0,
                "longitude_deg": 120.0,  # Valid domain is 80 to 88
            },
        )
        self.assertEqual(r_lon.status_code, 422)
        self.assertEqual(r_lon.json()["error"]["code"], "VALIDATION_OUT_OF_BOUNDS")

        # 3. Depth out of bounds
        r_depth = self.client.post(
            "/api/v1/queries/value",
            json={
                "dataset_id": "copernicus_phy_thetao",
                "variable_id": "sea_water_potential_temperature",
                "latitude_deg": 4.0,
                "longitude_deg": 84.0,
                "vertical_selector_type": "physical_depth_meters",
                "vertical_target_value": 3000.0,  # Max depth is 453.94m
            },
        )
        self.assertEqual(r_depth.status_code, 422)
        self.assertEqual(r_depth.json()["error"]["code"], "VALIDATION_OUT_OF_BOUNDS")

        # 4. Unknown variable
        r_var = self.client.post(
            "/api/v1/queries/value",
            json={
                "dataset_id": "copernicus_phy_thetao",
                "variable_id": "sea_water_salinity",
                "latitude_deg": 4.0,
                "longitude_deg": 84.0,
            },
        )
        self.assertEqual(r_var.status_code, 404)
        self.assertEqual(r_var.json()["error"]["code"], "DATA_VARIABLE_NOT_FOUND")

        # 5. Temporal out of bounds
        r_time = self.client.post(
            "/api/v1/queries/value",
            json={
                "dataset_id": "copernicus_phy_thetao",
                "variable_id": "sea_water_potential_temperature",
                "latitude_deg": 4.0,
                "longitude_deg": 84.0,
                "target_time_utc": "2030-01-01T00:00:00Z",
                "time_selector_mode": "exact_utc_timestamp",
            },
        )
        self.assertEqual(r_time.status_code, 422)
        self.assertEqual(r_time.json()["error"]["code"], "VALIDATION_OUT_OF_BOUNDS")

    # =========================================================================
    # 6. Provisional GPU Pick Reconciliation
    # =========================================================================
    def test_provisional_render_pick_reconciliation(self):
        """Test reconciliation of approximate GPU raycast pick against native NetCDF truth."""
        provisional = ProvisionalRenderPickResponse(
            response_type="approximate_render_sample",
            visualization_product_id="vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087",
            lod_level=0,
            approximate_value=28.50,
            display_units="degree_Celsius",
            world_ray_hit_position=[84.0, 4.0, -0.494],
            estimated_sample_error_bound=0.01,
        )

        reconcile_req = ReconcilePickRequest(
            provisional_pick=provisional,
            latitude_deg=4.0,
            longitude_deg=84.0,
            depth_m=0.494,
            target_time_utc="2026-08-30T00:00:00Z",
        )

        resp = self.engine.execute_reconcile_pick(reconcile_req)
        self.assertEqual(resp.response_type, "authoritative_reconciled_pick")
        self.assertEqual(resp.provisional_value, 28.50)
        self.assertIsNotNone(resp.authoritative_response.scientific_value)
        self.assertIsNotNone(resp.absolute_difference_delta)
        self.assertIsNotNone(resp.relative_difference_percent)
        self.assertIn("PROVISIONAL PICK RECONCILED", resp.reconciliation_notice)

    # =========================================================================
    # 7. Strict Assertion Proving Query Engine NEVER Opens .bin.zst Bricks
    # =========================================================================
    def test_query_engine_never_opens_visualization_bricks(self):
        """
        Audit all file opens during exact point and profile queries to prove
        that the query engine strictly reads native NetCDF and NEVER accesses .bin.zst brick payloads.
        """
        opened_files = []
        original_open = builtin_open

        def audit_open(file, *args, **kwargs):
            opened_files.append(str(file))
            return original_open(file, *args, **kwargs)

        import builtins
        builtins.open = audit_open

        try:
            # Execute point query
            self.engine.execute_exact_point_query(
                ExactValueQueryRequest(
                    dataset_id="copernicus_phy_thetao",
                    variable_id="sea_water_potential_temperature",
                    latitude_deg=2.0,
                    longitude_deg=85.0,
                    vertical_target_value=50.0,
                )
            )

            # Execute profile query
            self.engine.execute_vertical_profile_query(
                VerticalProfileQueryRequest(
                    dataset_id="copernicus_phy_thetao",
                    variable_id="sea_water_potential_temperature",
                    latitude_deg=2.0,
                    longitude_deg=85.0,
                )
            )
        finally:
            builtins.open = original_open

        # Assert no .bin.zst or visualization brick files were opened
        brick_accesses = [f for f in opened_files if f.endswith(".bin.zst") or "visualization" in f]
        self.assertEqual(
            len(brick_accesses),
            0,
            f"Violation of ADR-0005: Query engine accessed visualization brick files: {brick_accesses}",
        )

    # =========================================================================
    # 8. Performance Benchmark Assertions
    # =========================================================================
    def test_query_performance_benchmarks(self):
        """
        Assert warmed query performance:
        - Single-point query p95 < 50ms.
        - Vertical profile query p95 < 150ms.
        """
        req_point = ExactValueQueryRequest(
            dataset_id="copernicus_phy_thetao",
            variable_id="sea_water_potential_temperature",
            latitude_deg=4.0,
            longitude_deg=84.0,
            vertical_target_value=25.0,
        )
        req_profile = VerticalProfileQueryRequest(
            dataset_id="copernicus_phy_thetao",
            variable_id="sea_water_potential_temperature",
            latitude_deg=4.0,
            longitude_deg=84.0,
        )

        # Warmup
        self.engine.execute_exact_point_query(req_point)
        self.engine.execute_vertical_profile_query(req_profile)

        # 1. Point query benchmark (100 iterations)
        point_latencies = []
        for _ in range(100):
            t0 = time.perf_counter()
            self.engine.execute_exact_point_query(req_point)
            t1 = time.perf_counter()
            point_latencies.append((t1 - t0) * 1000.0)

        p95_point = np.percentile(point_latencies, 95)
        self.assertLess(
            p95_point,
            50.0,
            f"Point query p95 latency {p95_point:.2f}ms exceeded 50ms threshold",
        )

        # 2. Profile query benchmark (50 iterations)
        profile_latencies = []
        for _ in range(50):
            t0 = time.perf_counter()
            self.engine.execute_vertical_profile_query(req_profile)
            t1 = time.perf_counter()
            profile_latencies.append((t1 - t0) * 1000.0)

        p95_profile = np.percentile(profile_latencies, 95)
        self.assertLess(
            p95_profile,
            150.0,
            f"Profile query p95 latency {p95_profile:.2f}ms exceeded 150ms threshold",
        )


if __name__ == "__main__":
    unittest.main()
