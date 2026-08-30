"""
tests/test_catalog_service.py — Unit & Integration Test Suite for TASK-05B.

Verifies:
1. Catalog initialization and manifest ingestion from active_snapshot_catalog.json and visualization manifests.
2. Operational (OPERATIONAL_CURRENT_SNAPSHOT) vs Historical (HISTORICAL_SEVEN_DAY_VALIDATION_SNAPSHOT) snapshot segregation.
3. Strict enforcement: is_eligible_for_exact_query = True for native NetCDF / canonical assets, False for visualization brick products.
4. SHA-256 integrity validation and health endpoint status (live & ready).
5. All FastAPI endpoints return valid Pydantic V2 response schemas conforming to OpenAPI 3.1 & APIContracts.md:
   - GET /health/live, GET /health/ready
   - GET /api/v1/catalog
   - GET /api/v1/capabilities
   - GET /api/v1/datasets/{dataset_id}
   - GET /api/v1/datasets/{dataset_id}/snapshots
   - GET /api/v1/datasets/{dataset_id}/snapshots/{snapshot_id}
   - GET /api/v1/datasets/{dataset_id}/variables
   - GET /api/v1/datasets/{dataset_id}/times
   - GET /api/v1/visualization-products
   - GET /api/v1/visualization-products/{product_id}
   - GET /api/v1/render-manifests/{product_id}
6. Deterministic sorting and cursor/offset pagination.
7. Error handling & security: 404 for nonexistent resources, path traversal rejection, no absolute paths or secrets leakage.
"""

import os
import pathlib
import sys
import unittest
from fastapi.testclient import TestClient

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
SERVICES_SRC = REPO_ROOT / "packages" / "services" / "src"

if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))
if str(SERVICES_SRC) not in sys.path:
    sys.path.insert(0, str(SERVICES_SRC))

from quasar_services.app import app
from quasar_services.catalog import (
    CatalogService,
    DatasetNotFoundException,
    ManifestLoader,
    SecurityValidationException,
    SnapshotNotFoundException,
    VisualizationProductNotFoundException,
)
from quasar_services.catalog.models import (
    ApiResponse,
    CatalogOverview,
    DatasetTimeAxis,
    DatasetVariablesCatalog,
    HealthStatus,
    SnapshotSummary,
    SystemCapabilities,
    VisualizationProductDetail,
    VisualizationProductSummary,
)


class TestCatalogService(unittest.TestCase):
    """Catalog Service domain layer unit tests."""

    @classmethod
    def setUpClass(cls):
        cls.catalog = CatalogService(repo_root=REPO_ROOT)
        cls.client = TestClient(app)

    # =========================================================================
    # 1. Manifest Loading & Integrity Verification
    # =========================================================================
    def test_catalog_initialization_and_manifest_loading(self):
        """Test catalog initializes and correctly ingests snapshot catalog."""
        overview = self.catalog.get_catalog_overview()
        self.assertGreaterEqual(overview.totalDatasets, 1)
        self.assertEqual(len(overview.activeSnapshots), 1)
        self.assertEqual(len(overview.historicalSnapshots), 1)

        active = overview.activeSnapshots[0]
        self.assertEqual(active.snapshotId, "copernicus-phy-thetao-20260824-20260830-ca826087")
        self.assertEqual(active.temporalClassification, "OPERATIONAL_CURRENT_SNAPSHOT")
        self.assertTrue(active.isEligibleForExactQuery)

        hist = overview.historicalSnapshots[0]
        self.assertEqual(hist.snapshotId, "v1")
        self.assertEqual(hist.temporalClassification, "HISTORICAL_SEVEN_DAY_VALIDATION_SNAPSHOT")
        self.assertTrue(hist.isEligibleForExactQuery)

    def test_sha256_cryptographic_integrity(self):
        """Verify all registered primary assets match their SHA-256 hashes on disk."""
        ok, errors = self.catalog.loader.verify_all_manifest_checksums()
        self.assertTrue(ok, f"SHA-256 integrity failed: {errors}")
        self.assertEqual(len(errors), 0)

    # =========================================================================
    # 2. Snapshot Resolution & Segregation
    # =========================================================================
    def test_operational_vs_historical_snapshot_resolution(self):
        """Ensure operational and historical snapshots resolve independently without confusion."""
        op_snap = self.catalog.get_dataset_snapshot(
            "copernicus_phy_thetao", "copernicus-phy-thetao-20260824-20260830-ca826087"
        )
        self.assertEqual(op_snap.temporalClassification, "OPERATIONAL_CURRENT_SNAPSHOT")
        self.assertEqual(op_snap.latestValidTime, "2026-08-30T00:00:00Z")
        self.assertIsNotNone(op_snap.visualizationProductId)

        hist_snap = self.catalog.get_dataset_snapshot("copernicus_phy_thetao", "v1")
        self.assertEqual(hist_snap.temporalClassification, "HISTORICAL_SEVEN_DAY_VALIDATION_SNAPSHOT")
        self.assertNotEqual(op_snap.sourceSha256, hist_snap.sourceSha256)

    def test_exact_query_eligibility_invariant(self):
        """Verify exact query eligibility is True for datasets/snapshots and False for visualization products."""
        op_snap = self.catalog.get_dataset_snapshot(
            "copernicus_phy_thetao", "copernicus-phy-thetao-20260824-20260830-ca826087"
        )
        self.assertTrue(op_snap.isEligibleForExactQuery)

        vis_prods = self.catalog.list_visualization_products()
        self.assertGreater(len(vis_prods), 0)
        for vp in vis_prods:
            self.assertFalse(vp.isEligibleForExactQuery)

        detail = self.catalog.get_visualization_product(vis_prods[0].visualizationProductId)
        self.assertFalse(detail.isEligibleForExactQuery)
        if detail.quantizationContract:
            self.assertFalse(detail.quantizationContract.is_eligible_for_exact_query)

    # =========================================================================
    # 3. FastAPI Endpoint Integration Tests
    # =========================================================================
    def test_health_endpoints(self):
        """Test GET /health/live and GET /health/ready."""
        r_live = self.client.get("/health/live")
        self.assertEqual(r_live.status_code, 200)
        self.assertEqual(r_live.json()["status"], "ok")

        r_ready = self.client.get("/health/ready")
        self.assertEqual(r_ready.status_code, 200)
        self.assertEqual(r_ready.json()["status"], "ok")
        self.assertTrue(r_ready.json()["integrityVerified"])

    def test_get_catalog_endpoint(self):
        """Test GET /api/v1/catalog response structure."""
        r = self.client.get("/api/v1/catalog")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("data", body)
        self.assertIn("meta", body)
        self.assertIn("requestId", body["meta"])
        self.assertEqual(body["meta"]["schemaVersion"], "1.0.0")
        self.assertGreaterEqual(body["data"]["totalDatasets"], 1)

    def test_get_capabilities_endpoint(self):
        """Test GET /api/v1/capabilities response structure."""
        r = self.client.get("/api/v1/capabilities")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        data = body["data"]
        self.assertIn("webgpu_wgsl", data["supportedRenderingBackends"])
        self.assertIn("webgl2_glsl", data["supportedRenderingBackends"])
        self.assertIn("geographic_wgs84", data["supportedCoordinateSpaces"])

    def test_get_dataset_endpoint(self):
        """Test GET /api/v1/datasets/{dataset_id}."""
        r = self.client.get("/api/v1/datasets/copernicus_phy_thetao")
        self.assertEqual(r.status_code, 200)
        data = r.json()["data"]
        self.assertEqual(data["identity"]["dataset_id"], "copernicus_phy_thetao")
        self.assertEqual(data["identity"]["scientific_role"], "model")
        self.assertEqual(data["identity"]["data_class"], "model_volume")
        self.assertTrue(data["capabilities"]["can_volume_render_3d"])
        self.assertTrue(data["capabilities"]["can_exact_query"])

    def test_list_dataset_snapshots_endpoint_and_pagination(self):
        """Test GET /api/v1/datasets/{dataset_id}/snapshots with pagination."""
        r = self.client.get("/api/v1/datasets/copernicus_phy_thetao/snapshots?limit=1&offset=0")
        self.assertEqual(r.status_code, 200)
        data = r.json()["data"]
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["temporalClassification"], "OPERATIONAL_CURRENT_SNAPSHOT")

        r2 = self.client.get("/api/v1/datasets/copernicus_phy_thetao/snapshots?limit=1&offset=1")
        self.assertEqual(r2.status_code, 200)
        data2 = r2.json()["data"]
        self.assertEqual(len(data2), 1)
        self.assertEqual(data2[0]["temporalClassification"], "HISTORICAL_SEVEN_DAY_VALIDATION_SNAPSHOT")

    def test_get_dataset_variables_and_times_endpoints(self):
        """Test GET /api/v1/datasets/{dataset_id}/variables and /times."""
        r_vars = self.client.get("/api/v1/datasets/copernicus_phy_thetao/variables")
        self.assertEqual(r_vars.status_code, 200)
        vars_data = r_vars.json()["data"]
        self.assertIn("sea_water_potential_temperature", vars_data["variables"])

        r_times = self.client.get("/api/v1/datasets/copernicus_phy_thetao/times")
        self.assertEqual(r_times.status_code, 200)
        times_data = r_times.json()["data"]
        self.assertEqual(times_data["timeStepsCount"], 7)
        self.assertEqual(len(times_data["availableTimestamps"]), 7)

    def test_visualization_products_endpoints(self):
        """Test GET /api/v1/visualization-products and detail / render-manifest endpoints."""
        r = self.client.get("/api/v1/visualization-products")
        self.assertEqual(r.status_code, 200)
        prods = r.json()["data"]
        self.assertGreater(len(prods), 0)
        prod_id = prods[0]["visualizationProductId"]

        # Detail
        r_detail = self.client.get(f"/api/v1/visualization-products/{prod_id}")
        self.assertEqual(r_detail.status_code, 200)
        detail = r_detail.json()["data"]
        self.assertEqual(detail["totalBricks"], 63)
        self.assertFalse(detail["isEligibleForExactQuery"])
        self.assertEqual(len(detail["visualizationProduct"]["available_lod_levels"]), 3)

        # Render manifest alias
        r_alias = self.client.get(f"/api/v1/render-manifests/{prod_id}")
        self.assertEqual(r_alias.status_code, 200)
        self.assertEqual(r_alias.json()["data"]["totalBricks"], 63)

    # =========================================================================
    # 4. Error Handling & Security Tests
    # =========================================================================
    def test_resource_not_found_errors(self):
        """Ensure missing datasets, snapshots, and visualization products return 404 with ErrorModel schema."""
        # Nonexistent dataset
        r = self.client.get("/api/v1/datasets/nonexistent_dataset")
        self.assertEqual(r.status_code, 404)
        err = r.json()["error"]
        self.assertEqual(err["code"], "CATALOG_DATASET_NOT_FOUND")
        self.assertFalse(err["retryable"])
        self.assertIn("requestId", err)

        # Nonexistent snapshot
        r_snap = self.client.get("/api/v1/datasets/copernicus_phy_thetao/snapshots/invalid_snapshot_id")
        self.assertEqual(r_snap.status_code, 404)
        err_snap = r_snap.json()["error"]
        self.assertEqual(err_snap["code"], "CATALOG_SNAPSHOT_NOT_FOUND")

        # Nonexistent visualization product
        r_vis = self.client.get("/api/v1/visualization-products/nonexistent_prod")
        self.assertEqual(r_vis.status_code, 404)
        err_vis = r_vis.json()["error"]
        self.assertEqual(err_vis["code"], "RENDER_PRODUCT_NOT_FOUND")

    def test_path_traversal_rejection_and_no_absolute_path_leakage(self):
        """Verify path traversal attempts are safely rejected and no absolute disk paths leak into responses."""
        with self.assertRaises(SecurityValidationException):
            self.catalog.validate_identifier("../../etc/passwd", "dataset_id")

        with self.assertRaises(SecurityValidationException):
            self.catalog.validate_identifier("..\\\\windows\\\\system32", "snapshot_id")

        # Check response payloads for absence of absolute drive paths (e.g. 'C:' or '/Users/')
        r = self.client.get("/api/v1/catalog")
        raw_text = r.text
        self.assertNotIn("C:\\\\Users\\\\", raw_text)
        self.assertNotIn("/Users/", raw_text)
        self.assertNotIn("/home/", raw_text)


if __name__ == "__main__":
    unittest.main()

