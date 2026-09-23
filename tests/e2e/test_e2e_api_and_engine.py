"""
E2E API & Scientific Analysis Router Integration Test Suite (VISUALIZATION-REMEDIATION-03)
Tests all `/api/v1/analysis/*` endpoints end-to-end against native NetCDF files using FastAPI TestClient.
"""

from pathlib import Path
import sys
import unittest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
for pkg in ["contracts", "services", "ingestion", "runtime"]:
    p = REPO_ROOT / "packages" / pkg / "src"
    if p.exists() and str(p) not in sys.path:
        sys.path.insert(0, str(p))

from fastapi.testclient import TestClient
from quasar_services.app import create_app


class TestE2EApiAndEngine(unittest.TestCase):
    """End-to-End API Router & Scientific Engine Verification."""

    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = TestClient(cls.app)

    def test_e2e_essential_data_probe_endpoint(self):
        """Verify GET /api/v1/analysis/essential-data-probe returns 200 and healthy status."""
        resp = self.client.get("/api/v1/analysis/essential-data-probe")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("status"), "ok")
        self.assertEqual(data.get("timesteps_available"), 7)

    def test_e2e_volume_grid_endpoint_thetao(self):
        """Verify GET /api/v1/analysis/volume-grid for potential temperature (thetao)."""
        resp = self.client.get("/api/v1/analysis/volume-grid?variable=thetao&time_index=0&depth_levels=8&lat_res=16&lon_res=16")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("variable"), "thetao")
        self.assertEqual(data.get("time_index"), 0)
        self.assertEqual(len(data.get("depth_m", [])), 8)
        self.assertEqual(len(data.get("scalars", [])), 8 * 16 * 16)
        self.assertIn("request_id", data)

    def test_e2e_volume_grid_endpoint_all_variables(self):
        """Verify volume grid generation across all 5 variables."""
        for var in ["thetao", "so", "uo", "vo", "zos"]:
            resp = self.client.get(f"/api/v1/analysis/volume-grid?variable={var}&time_index=0&depth_levels=4&lat_res=8&lon_res=8")
            self.assertEqual(resp.status_code, 200, f"Failed for variable {var}: {resp.text}")
            data = resp.json()
            self.assertEqual(data["variable"], var)

    def test_e2e_volume_grid_invalid_variable(self):
        """Verify GET /api/v1/analysis/volume-grid with invalid variable returns 400."""
        resp = self.client.get("/api/v1/analysis/volume-grid?variable=invalid_var_123")
        self.assertEqual(resp.status_code, 400)
        err = resp.json()
        self.assertTrue("error" in err or "detail" in err)

    def test_e2e_teos10_soundings_endpoint(self):
        """Verify POST /api/v1/analysis/teos10-soundings returns GSW thermodynamic calculations."""
        payload = {
            "time_index": 0,
            "latitude": 7.5,
            "longitude": 64.0,
        }
        resp = self.client.post("/api/v1/analysis/teos10-soundings", json=payload)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn("conservative_temperature_c", data)
        self.assertIn("absolute_salinity_g_kg", data)
        self.assertIn("in_situ_density_kg_m3", data)
        self.assertIn("brunt_vaisala_n2_s2", data)
        self.assertGreaterEqual(data.get("levels_count", 0), 10)

    def test_e2e_teos10_soundings_out_of_bounds(self):
        """Verify POST /api/v1/analysis/teos10-soundings with out-of-domain coordinate returns 422."""
        payload = {
            "time_index": 0,
            "latitude": 45.0,  # outside [-3, 15]
            "longitude": 64.0,
        }
        resp = self.client.post("/api/v1/analysis/teos10-soundings", json=payload)
        self.assertEqual(resp.status_code, 422)

    def test_e2e_vertical_profile_endpoint(self):
        """Verify POST /api/v1/analysis/profile extracts sounding profile."""
        payload = {
            "variable": "thetao",
            "time_index": 2,
            "latitude": 10.0,
            "longitude": 70.0,
        }
        resp = self.client.post("/api/v1/analysis/profile", json=payload)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIn("samples", data)
        self.assertGreater(len(data["samples"]), 0)

    def test_e2e_transect_endpoint(self):
        """Verify POST /api/v1/analysis/transect interpolates along geodetic path."""
        payload = {
            "variable": "thetao",
            "time_index": 0,
            "start_latitude": 5.0,
            "start_longitude": 65.0,
            "end_latitude": 12.0,
            "end_longitude": 75.0,
            "num_samples": 10,
        }
        resp = self.client.post("/api/v1/analysis/transect", json=payload)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertEqual(len(data.get("samples", [])), 10)

    def test_e2e_horizontal_slice_endpoint(self):
        """Verify POST /api/v1/analysis/slice extracts 2D horizontal layer."""
        payload = {
            "variable": "thetao",
            "time_index": 1,
            "depth_m": 100.0,
        }
        resp = self.client.post("/api/v1/analysis/slice", json=payload)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertEqual(data.get("variable"), "thetao")
        self.assertIn("scalars", data)


if __name__ == "__main__":
    unittest.main()
