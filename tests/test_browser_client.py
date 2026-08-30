"""
TASK-06B: Typed Browser Catalog and API Client Integration Test Suite.

Validates that:
1. All client-facing endpoints in OpenAPI 3.1 & APIContracts.md respond with expected data and envelopes.
2. The active operational snapshot is consistent with client baseline expectations.
3. Render manifest alias and brick download routes conform to TASK-05T.
4. Exact point queries, vertical column profile queries, and pick reconciliation work end-to-end.
5. Structured error responses match ErrorModel.md.
6. The Node/TypeScript client test suite executes and passes 100% of its assertions.
"""

import subprocess
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

from quasar_services.app import create_app

REPO_ROOT = Path(__file__).resolve().parent.parent


class TestBrowserClientIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = TestClient(cls.app)
        cls.active_snapshot_id = "copernicus-phy-thetao-20260824-20260830-ca826087"
        cls.active_dataset_id = "copernicus_phy_thetao"
        cls.active_vis_product_id = f"vis_{cls.active_dataset_id}_{cls.active_snapshot_id}"

    def test_health_endpoints(self):
        """Test control plane liveness and readiness probes."""
        res_live = self.client.get("/health/live")
        self.assertEqual(res_live.status_code, 200)
        self.assertEqual(res_live.json()["status"], "ok")

        res_ready = self.client.get("/health/ready")
        self.assertEqual(res_ready.status_code, 200)
        self.assertTrue(res_ready.json()["integrityVerified"])

    def test_catalog_discovery_and_pinning_baseline(self):
        """Test catalog discovery and ensure active snapshot matches pinned baseline."""
        res = self.client.get("/api/v1/catalog")
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn("data", payload)
        self.assertIn("meta", payload)

        catalog = payload["data"]
        self.assertGreaterEqual(catalog["totalDatasets"], 1)
        
        target_dataset = next((d for d in catalog["datasets"] if d["datasetId"] == self.active_dataset_id), None)
        self.assertIsNotNone(target_dataset)
        self.assertEqual(target_dataset["activeSnapshotId"], self.active_snapshot_id)

        active_snap = next((s for s in catalog["activeSnapshots"] if s["snapshotId"] == self.active_snapshot_id), None)
        self.assertIsNotNone(active_snap)
        self.assertEqual(active_snap["visualizationProductId"], self.active_vis_product_id)
        self.assertTrue(active_snap["immutable"])

    def test_capabilities_endpoint(self):
        """Test capabilities endpoint returns WebGPU/WebGL2 and coordinate spaces."""
        res = self.client.get("/api/v1/capabilities")
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertIn("webgpu_wgsl", data["supportedRenderingBackends"])
        self.assertIn("webgl2_glsl", data["supportedRenderingBackends"])
        self.assertIn("geographic_wgs84", data["supportedCoordinateSpaces"])

    def test_dataset_and_snapshots_metadata(self):
        """Test retrieval of dataset contract, snapshot details, variables, and time axis."""
        res_ds = self.client.get(f"/api/v1/datasets/{self.active_dataset_id}")
        self.assertEqual(res_ds.status_code, 200)
        self.assertEqual(res_ds.json()["data"]["identity"]["dataset_id"], self.active_dataset_id)

        res_snaps = self.client.get(f"/api/v1/datasets/{self.active_dataset_id}/snapshots")
        self.assertEqual(res_snaps.status_code, 200)
        self.assertGreaterEqual(len(res_snaps.json()["data"]), 1)

        res_vars = self.client.get(f"/api/v1/datasets/{self.active_dataset_id}/variables")
        self.assertEqual(res_vars.status_code, 200)
        self.assertIn("sea_water_potential_temperature", res_vars.json()["data"]["variables"])

        res_times = self.client.get(f"/api/v1/datasets/{self.active_dataset_id}/times")
        self.assertEqual(res_times.status_code, 200)
        self.assertEqual(res_times.json()["data"]["timeStepsCount"], 7)

    def test_render_manifest_and_alias_endpoint(self):
        """Test render manifest alias endpoint conforming to APIContracts.md."""
        res_alias = self.client.get(f"/api/v1/render-manifests/{self.active_vis_product_id}")
        self.assertEqual(res_alias.status_code, 200)
        data = res_alias.json()["data"]
        self.assertEqual(data["visualizationProduct"]["visualization_product_id"], self.active_vis_product_id)
        self.assertGreaterEqual(data["totalBricks"], 63)
        self.assertFalse(data["isEligibleForExactQuery"])

    def test_exact_value_query_point(self):
        """Test authoritative exact value query (POST /api/v1/queries/value)."""
        body = {
            "dataset_id": self.active_dataset_id,
            "snapshot_id": self.active_snapshot_id,
            "variable_id": "sea_water_potential_temperature",
            "latitude_deg": 4.0,
            "longitude_deg": 84.0,
            "vertical_selector_type": "physical_depth_meters",
            "vertical_target_value": 0.494,
            "time_selector_mode": "exact_utc_timestamp",
            "target_time_utc": "2026-08-30T00:00:00Z",
            "selection_interpolation": {
                "method": "nearest_native_sample",
                "allows_extrapolation": False,
                "max_horizontal_extrapolation_deg": 0.1,
                "max_vertical_extrapolation_m": 5.0,
            },
        }
        res = self.client.post("/api/v1/queries/value", json=body)
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual(data["response_type"], "authoritative_scientific_value")
        self.assertEqual(data["canonical_units"], "degree_Celsius")
        self.assertIsInstance(data["scientific_value"], float)

    def test_vertical_profile_query(self):
        """Test authoritative vertical profile column query (POST /api/v1/queries/profile)."""
        body = {
            "dataset_id": self.active_dataset_id,
            "snapshot_id": self.active_snapshot_id,
            "variable_id": "sea_water_potential_temperature",
            "latitude_deg": 4.0,
            "longitude_deg": 84.0,
            "target_time_utc": "2026-08-30T00:00:00Z",
        }
        res = self.client.post("/api/v1/queries/profile", json=body)
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual(data["response_type"], "authoritative_vertical_profile")
        self.assertEqual(data["total_levels"], 31)
        self.assertGreater(data["valid_levels_count"], 0)
        self.assertEqual(len(data["samples"]), 31)

    def test_reconcile_pick_endpoint(self):
        """Test GPU pick reconciliation endpoint (POST /api/v1/queries/reconcile-pick)."""
        body = {
            "provisional_pick": {
                "response_type": "approximate_render_sample",
                "visualization_product_id": self.active_vis_product_id,
                "lod_level": 0,
                "approximate_value": 28.5,
                "display_units": "degree_Celsius",
                "world_ray_hit_position": [84.0, 4.0, -0.494],
                "estimated_sample_error_bound": 0.05,
                "approximation_notice": "Provisional GPU sample",
            },
            "latitude_deg": 4.0,
            "longitude_deg": 84.0,
            "depth_m": 0.494,
        }
        res = self.client.post("/api/v1/queries/reconcile-pick", json=body)
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual(data["response_type"], "authoritative_reconciled_pick")
        self.assertIn("authoritative_response", data)
        self.assertIsNotNone(data["absolute_difference_delta"])

    def test_error_model_conformance(self):
        """Test 404 and 422 responses conform to ErrorModel.md."""
        res_404 = self.client.get("/api/v1/datasets/non_existent_dataset")
        self.assertEqual(res_404.status_code, 404)
        err = res_404.json()["error"]
        self.assertEqual(err["code"], "CATALOG_DATASET_NOT_FOUND")
        self.assertIn("requestId", err)
        self.assertFalse(err["retryable"])

        res_422 = self.client.post("/api/v1/queries/value", json={"invalid": "payload"})
        self.assertEqual(res_422.status_code, 422)
        err_val = res_422.json()["error"]
        self.assertEqual(err_val["code"], "VALIDATION_SCHEMA_VIOLATION")

    def test_node_client_test_suite_execution(self):
        """Execute the Node/TypeScript test suite to ensure browser client passes."""
        test_file = REPO_ROOT / "packages" / "client" / "test" / "client.test.ts"
        self.assertTrue(test_file.exists(), f"Missing {test_file}")

        proc = subprocess.run(
            ["node", "--test", "--experimental-strip-types", str(test_file)],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            proc.returncode,
            0,
            f"Node client test suite failed:\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}",
        )
        self.assertIn("pass 12", proc.stdout)


if __name__ == "__main__":
    unittest.main()
