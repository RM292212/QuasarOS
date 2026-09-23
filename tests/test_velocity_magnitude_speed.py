"""
tests/test_velocity_magnitude_speed.py — Comprehensive Unit & Integration Test Suite for Milestone 1 Backend Science.

Verifies:
1. Velocity magnitude (`speed = sqrt(uo^2 + vo^2)`) computation across all analysis engine methods:
   - `get_volume_slice_grid`
   - `query_point_timeseries`
   - `query_vertical_profile`
   - `compute_transect`
   - `compute_horizontal_slice`
2. Strict mathematical verification: |speed - sqrt(uo^2 + vo^2)| < 1e-4 on open-ocean points.
3. Numerical bounds: all valid speed values are non-negative (>= 0.0 m/s).
4. Missing value / land mask handling: -999.0 for volume grid and None for JSON soundings/profiles.
5. Units consistency: units="m/s".
6. API Router integration: FastAPI endpoints (/api/v1/analysis/...) return 200 OK and valid schemas for variable="speed".
7. Multi-dataset catalog registration: all 12 dataset families and aliases resolve in CatalogService and FastAPI.
"""

import math
import pathlib
import sys
import unittest
import numpy as np
from fastapi.testclient import TestClient

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
SERVICES_SRC = REPO_ROOT / "packages" / "services" / "src"

if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))
if str(SERVICES_SRC) not in sys.path:
    sys.path.insert(0, str(SERVICES_SRC))

from quasar_services.app import app
from quasar_services.analysis.analysis_engine import ScientificAnalysisEngine
from quasar_services.catalog import CatalogService


class TestVelocityMagnitudeSpeedEngine(unittest.TestCase):
    """Core domain logic tests for computed speed velocity magnitude."""

    @classmethod
    def setUpClass(cls):
        cls.engine = ScientificAnalysisEngine()
        cls.catalog = CatalogService(repo_root=REPO_ROOT)
        cls.client = TestClient(app)

    # =========================================================================
    # 1. Volume Slice Grid for Speed
    # =========================================================================
    def test_speed_volume_slice_grid_shape_and_metadata(self):
        """Verify get_volume_slice_grid for speed produces correct shape, bounds, and units."""
        # Default sampling resolution
        grid_data = self.engine.get_volume_slice_grid("speed", time_index=0)
        self.assertEqual(grid_data["variable"], "speed")
        self.assertEqual(grid_data["units"], "m/s")
        self.assertEqual(grid_data["shape"], [16, 32, 32])
        self.assertGreaterEqual(grid_data["min_val"], 0.0)
        self.assertLess(grid_data["max_val"], 5.0)  # Ocean currents rarely exceed 5 m/s

        arr = np.array(grid_data["data"]).reshape(grid_data["shape"])
        self.assertEqual(arr.shape, (16, 32, 32))

        # Check mask: values must either be -999.0 (fill/land) or >= 0.0
        valid_mask = arr != -999.0
        self.assertTrue(np.all(arr[valid_mask] >= 0.0))
        self.assertGreater(np.sum(valid_mask), 100)

        # Full native resolution grid
        full_grid = self.engine.get_volume_slice_grid("speed", time_index=0, depth_levels=31, lat_res=181, lon_res=97)
        self.assertEqual(full_grid["shape"], [31, 181, 97])
        self.assertGreaterEqual(full_grid["min_val"], 0.0)

    def test_speed_volume_slice_grid_mathematical_exactness(self):
        """Cross-check speed against uo and vo directly: speed == sqrt(uo^2 + vo^2)."""
        speed_grid = self.engine.get_volume_slice_grid("speed", time_index=0, depth_levels=31, lat_res=181, lon_res=97)
        uo_grid = self.engine.get_volume_slice_grid("uo", time_index=0, depth_levels=31, lat_res=181, lon_res=97)
        vo_grid = self.engine.get_volume_slice_grid("vo", time_index=0, depth_levels=31, lat_res=181, lon_res=97)

        s_arr = np.array(speed_grid["data"])
        u_arr = np.array(uo_grid["data"])
        v_arr = np.array(vo_grid["data"])

        # Filter valid ocean points where neither uo nor vo is masked
        valid_points = (u_arr != -999.0) & (v_arr != -999.0) & (s_arr != -999.0)
        self.assertGreater(np.sum(valid_points), 1000)

        expected_speed = np.sqrt(u_arr[valid_points] ** 2 + v_arr[valid_points] ** 2)
        actual_speed = s_arr[valid_points]

        max_diff = np.max(np.abs(actual_speed - expected_speed))
        self.assertLess(max_diff, 1e-4, f"Speed differs from sqrt(uo^2 + vo^2) by {max_diff}")

    # =========================================================================
    # 2. Point Time Series for Speed
    # =========================================================================
    def test_speed_point_timeseries(self):
        """Verify query_point_timeseries computes valid non-negative speed values across all timesteps."""
        lat, lon, depth = 7.5, 64.0, 0.494
        res_speed = self.engine.query_point_timeseries("speed", lat, lon, depth)
        res_uo = self.engine.query_point_timeseries("uo", lat, lon, depth)
        res_vo = self.engine.query_point_timeseries("vo", lat, lon, depth)

        self.assertEqual(res_speed["variable"], "speed")
        self.assertEqual(res_speed["units"], "m/s")
        self.assertEqual(len(res_speed["timesteps"]), 7)
        self.assertEqual(len(res_speed["values"]), 7)

        for i in range(7):
            s_val = res_speed["values"][i]
            u_val = res_uo["values"][i]
            v_val = res_vo["values"][i]

            self.assertIsNotNone(s_val)
            self.assertGreaterEqual(s_val, 0.0)

            expected = math.sqrt(u_val ** 2 + v_val ** 2)
            self.assertAlmostEqual(s_val, expected, places=4)

    # =========================================================================
    # 3. Vertical Profile for Speed
    # =========================================================================
    def test_speed_vertical_profile(self):
        """Verify query_vertical_profile computes 50-level speed soundings matching sqrt(uo^2 + vo^2)."""
        time_idx, lat, lon = 0, 7.5, 64.0
        res_speed = self.engine.query_vertical_profile("speed", time_idx, lat, lon)
        res_uo = self.engine.query_vertical_profile("uo", time_idx, lat, lon)
        res_vo = self.engine.query_vertical_profile("vo", time_idx, lat, lon)

        self.assertEqual(res_speed["variable"], "speed")
        self.assertEqual(res_speed["units"], "m/s")
        self.assertEqual(len(res_speed["depth_levels_m"]), 50)
        self.assertEqual(len(res_speed["values"]), 50)

        valid_count = 0
        for i in range(50):
            s_val = res_speed["values"][i]
            u_val = res_uo["values"][i]
            v_val = res_vo["values"][i]

            if s_val is not None:
                valid_count += 1
                self.assertGreaterEqual(s_val, 0.0)
                self.assertIsNotNone(u_val)
                self.assertIsNotNone(v_val)
                expected = math.sqrt(u_val ** 2 + v_val ** 2)
                self.assertAlmostEqual(s_val, expected, places=4)

        self.assertGreater(valid_count, 35)

    # =========================================================================
    # 4. Transect for Speed
    # =========================================================================
    def test_speed_transect_computation(self):
        """Verify compute_transect produces valid multi-segment transects for speed."""
        points = [
            {"latitude": 5.0, "longitude": 62.0},
            {"latitude": 7.5, "longitude": 64.0},
            {"latitude": 10.0, "longitude": 66.0},
        ]
        res = self.engine.compute_transect(points=points, variable="speed", time_index=0)

        self.assertEqual(res["variable"], "speed")
        self.assertEqual(res["units"], "m/s")
        self.assertEqual(len(res["soundings"]), 3)

        for s in res["soundings"]:
            self.assertIn("latitude", s)
            self.assertIn("longitude", s)
            self.assertIn("values", s)
            valid_vals = [v for v in s["values"] if v is not None]
            self.assertGreater(len(valid_vals), 0)
            self.assertTrue(all(v >= 0.0 for v in valid_vals))

    # =========================================================================
    # 5. Horizontal Slice for Speed
    # =========================================================================
    def test_speed_horizontal_slice(self):
        """Verify compute_horizontal_slice computes 2D speed grid with correct dimensions and units."""
        res = self.engine.compute_horizontal_slice(depth_m=0.494, variable="speed", time_index=0)

        self.assertEqual(res["variable"], "speed")
        self.assertEqual(res["units"], "m/s")
        self.assertEqual(res["shape"], [181, 97])
        self.assertEqual(len(res["values"]), 181)
        self.assertEqual(len(res["values"][0]), 97)

        # Confirm non-negative values for unmasked ocean cells
        flattened = [v for row in res["values"] for v in row if v is not None]
        self.assertGreater(len(flattened), 1000)
        self.assertTrue(all(v >= 0.0 for v in flattened))

    # =========================================================================
    # 6. Error Handling & Validation
    # =========================================================================
    def test_speed_error_handling(self):
        """Test out of bounds and invalid parameters raise appropriate errors."""
        # Out of bounds latitude
        with self.assertRaises(ValueError):
            self.engine.query_point_timeseries("speed", 120.0, 64.0, 0.494)

        # Out of bounds longitude
        with self.assertRaises(ValueError):
            self.engine.query_point_timeseries("speed", 7.5, 250.0, 0.494)

        # Invalid variable name
        with self.assertRaises(ValueError):
            self.engine.query_point_timeseries("unknown_var", 7.5, 64.0, 0.494)


class TestVelocityMagnitudeSpeedAPI(unittest.TestCase):
    """Integration tests verifying HTTP endpoints with speed requests."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_api_volume_grid_speed(self):
        """Test GET /api/v1/analysis/volume-grid with variable=speed."""
        response = self.client.get("/api/v1/analysis/volume-grid?variable=speed&time_index=0")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["variable"], "speed")
        self.assertEqual(data["units"], "m/s")
        self.assertEqual(data["shape"], [16, 32, 32])
        self.assertGreaterEqual(data["min_val"], 0.0)

    def test_api_timeseries_speed(self):
        """Test POST /api/v1/analysis/timeseries with variable=speed."""
        payload = {
            "variable": "speed",
            "latitude": 7.5,
            "longitude": 64.0,
            "depth_m": 0.494,
        }
        response = self.client.post("/api/v1/analysis/timeseries", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["variable"], "speed")
        self.assertEqual(data["units"], "m/s")
        self.assertEqual(len(data["values"]), 7)

    def test_api_profile_speed(self):
        """Test POST /api/v1/analysis/profile with variable=speed."""
        payload = {
            "variable": "speed",
            "time_index": 0,
            "latitude": 7.5,
            "longitude": 64.0,
        }
        response = self.client.post("/api/v1/analysis/profile", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["variable"], "speed")
        self.assertEqual(data["units"], "m/s")
        self.assertEqual(len(data["values"]), 50)

    def test_api_transect_speed(self):
        """Test POST /api/v1/analysis/transect with variable=speed."""
        payload = {
            "variable": "speed",
            "time_index": 0,
            "start_latitude": 5.0,
            "start_longitude": 62.0,
            "end_latitude": 7.5,
            "end_longitude": 64.0,
            "num_samples": 8,
        }
        response = self.client.post("/api/v1/analysis/transect", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["variable"], "speed")
        self.assertEqual(data["units"], "m/s")
        self.assertEqual(len(data["soundings"]), 8)

    def test_api_slice_speed(self):
        """Test POST /api/v1/analysis/slice with variable=speed."""
        payload = {
            "variable": "speed",
            "time_index": 0,
            "depth_m": 0.494,
        }
        response = self.client.post("/api/v1/analysis/slice", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["variable"], "speed")
        self.assertEqual(data["units"], "m/s")
        self.assertEqual(data["shape"], [181, 97])


class TestMultiDatasetCatalogEngine(unittest.TestCase):
    """Tests verifying ingestion of all 12 dataset families in the Catalog Service."""

    @classmethod
    def setUpClass(cls):
        cls.catalog = CatalogService(repo_root=REPO_ROOT)
        cls.client = TestClient(app)

    def test_all_twelve_dataset_families_registered(self):
        """Verify all 12 dataset families are registered and listed in overview."""
        overview = self.catalog.get_catalog_overview()
        self.assertEqual(overview.totalDatasets, 12)
        dataset_ids = [d.datasetId for d in overview.datasets]

        expected_ids = [
            "copernicus_phy_thetao",
            "copernicus_waves",
            "copernicus_ocean_colour",
            "hycom_expanded",
            "incois_waves",
            "incois_godas_mom",
            "incois_bio_roms",
            "gebco_2026",
            "woa23_multivariable",
            "argo_gdac",
            "incois_argo",
            "noaa_ww3",
        ]

        for expected in expected_ids:
            self.assertIn(expected, dataset_ids, f"Dataset family '{expected}' not found in catalog overview.")

    def test_dataset_resolution_by_alias(self):
        """Verify alias resolution for datasets with long operational identifiers."""
        alias_test_cases = [
            ("copernicus_phy_multivariable", "copernicus_phy_thetao"),
            ("GLOBAL_ANALYSISFORECAST_PHY_001_024", "copernicus_phy_thetao"),
            ("cmems_mod_glo_wav_anfc_0.083deg_PT3H-i", "copernicus_waves"),
            ("cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D", "copernicus_ocean_colour"),
            ("hycom", "hycom_expanded"),
            ("INCOIS_RSMC_NIO_WW3_OPERATIONAL", "incois_waves"),
            ("INCOIS-GODAS-MOM", "incois_godas_mom"),
            ("INCOIS-BIO-ROMS-NIO", "incois_bio_roms"),
            ("GEBCO_2026", "gebco_2026"),
            ("WOA23-MULTIVARIABLE", "woa23_multivariable"),
            ("argo_gdac_north_indian_ocean", "argo_gdac"),
            ("Indian_ARGO_Floats", "incois_argo"),
            ("NWW3_Global_Best", "noaa_ww3"),
        ]

        for alias, primary in alias_test_cases:
            ds = self.catalog.get_dataset(alias)
            self.assertEqual(ds.identity.dataset_id, primary)

    def test_fastapi_dataset_endpoints_for_all_families(self):
        """Verify HTTP GET /api/v1/datasets/{dataset_id} for all 12 dataset families."""
        families = [
            "copernicus_phy_thetao",
            "copernicus_waves",
            "copernicus_ocean_colour",
            "hycom_expanded",
            "incois_waves",
            "incois_godas_mom",
            "incois_bio_roms",
            "gebco_2026",
            "woa23_multivariable",
            "argo_gdac",
            "incois_argo",
            "noaa_ww3",
        ]

        for fid in families:
            resp = self.client.get(f"/api/v1/datasets/{fid}")
            self.assertEqual(resp.status_code, 200, f"Failed for dataset '{fid}': {resp.text}")
            data = resp.json()["data"]
            self.assertEqual(data["identity"]["dataset_id"], fid)

            # Check variables endpoint
            var_resp = self.client.get(f"/api/v1/datasets/{fid}/variables")
            self.assertEqual(var_resp.status_code, 200)
            self.assertEqual(var_resp.json()["data"]["datasetId"], fid)

            # Check times endpoint
            time_resp = self.client.get(f"/api/v1/datasets/{fid}/times")
            self.assertEqual(time_resp.status_code, 200)
            self.assertEqual(time_resp.json()["data"]["datasetId"], fid)


if __name__ == "__main__":
    unittest.main()
